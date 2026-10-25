import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { safeEqual } from "@/lib/auth";
import { exchangeCode, fetchProfile, googleConfigured, OAUTH_COOKIE, redirectUri } from "@/lib/google";
import { createSession, SESSION_COOKIE, sessionCookieOptions, type Role } from "@/lib/session";

export const dynamic = "force-dynamic";

const { users } = schema;

function fail(req: Request) {
  const res = NextResponse.redirect(new URL("/login?erro=google", req.url));
  res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth" });
  return res;
}

// Owner: anyone in OWNER_EMAILS; with no list, the first person to sign in claims it.
async function roleFor(userId: number, email: string): Promise<Role> {
  const owners = (process.env.OWNER_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (owners.length) return owners.includes(email) ? "owner" : "waitlist";
  const claimed = await db()
    .update(users)
    .set({ role: "owner" })
    .where(and(eq(users.id, userId), sql`not exists (select 1 from ${users} where ${users.role} = 'owner')`))
    .returning({ id: users.id });
  if (claimed.length) return "owner";
  const [row] = await db().select({ role: users.role }).from(users).where(eq(users.id, userId));
  return row?.role === "owner" ? "owner" : "waitlist";
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

    const res = NextResponse.redirect(new URL(role === "owner" ? "/" : "/espera", req.url));
    res.cookies.set(SESSION_COOKIE, await createSession({ uid: user.id, email, role }), sessionCookieOptions);
    res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth" });
    return res;
  } catch (err) {
    console.error("google sign-in failed:", (err as Error).message);
    return fail(req);
  }
}
