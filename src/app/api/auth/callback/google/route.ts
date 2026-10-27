import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { safeEqual } from "@/lib/auth";
import { exchangeCode, fetchProfile, googleConfigured, OAUTH_COOKIE, redirectUri } from "@/lib/google";
import { createSession, SESSION_COOKIE, sessionCookieOptions, type Role } from "@/lib/session";
import { adminEmails, ensureWorkspace, isSetUp } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const { users } = schema;

function fail(req: Request) {
  const res = NextResponse.redirect(new URL("/login?erro=google", req.url));
  res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth" });
  return res;
}

// Admins (ADMIN_EMAILS) always get in and people an admin let in keep access; with no
// admin list, the first person to sign in on a fresh install sets the app up (only
// once: deleting that account later never hands the app to the next person).
// Everyone else waits.
async function roleFor(userId: number, email: string): Promise<Role> {
  const admins = adminEmails();
  if (admins.includes(email)) {
    await db().update(users).set({ role: "member" }).where(eq(users.id, userId));
    return "member";
  }
  const [row] = await db().select({ role: users.role }).from(users).where(eq(users.id, userId));
  if (row?.role === "member") return "member";
  if (admins.length || (await isSetUp())) return "waitlist";
  const claimed = await db()
    .update(users)
    .set({ role: "member" })
    .where(and(eq(users.id, userId), sql`not exists (select 1 from ${users} where ${users.role} = 'member')`))
    .returning({ id: users.id });
  return claimed.length ? "member" : "waitlist";
}

export async function GET(req: Request) {
  if (!googleConfigured()) return fail(req);
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = req.headers.get("cookie")?.match(new RegExp(`(?:^|; )${OAUTH_COOKIE}=([^;]+)`))?.[1];
  const [expected, verifier] = decodeURIComponent(cookie ?? "").split(".");
  if (!code || !state || !expected || !verifier || !safeEqual(state, expected)) return fail(req);

  try {
    const { access_token } = await exchangeCode(code, verifier, redirectUri(req));
    const profile = await fetchProfile(access_token);
    const email = profile.email?.toLowerCase();
    if (!email || profile.email_verified !== true) return fail(req);

    const [user] = await db()
      .insert(users)
      .values({ email, name: profile.name ?? null })
      .onConflictDoUpdate({ target: users.email, set: { name: profile.name ?? null, lastLoginAt: new Date() } })
      .returning();
    const role = await roleFor(user.id, email);
    // A member lands straight on their own dashboard: nothing to create or name.
    if (role === "member") await ensureWorkspace(user);

    const res = NextResponse.redirect(new URL(role === "member" ? "/" : "/espera", req.url));
    res.cookies.set(SESSION_COOKIE, await createSession({ uid: user.id, email, role }), sessionCookieOptions);
    res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth" });
    return res;
  } catch (err) {
    console.error("google sign-in failed:", (err as Error).message);
    return fail(req);
  }
}
