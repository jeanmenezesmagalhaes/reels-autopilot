import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { createSession, readSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { ensureWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// The cookie remembers the role from sign-in; this brings it in line with the database.
// Someone let in from the waitlist lands on their dashboard without signing in again,
// and someone whose access ended goes back to the waitlist screen.
export async function GET(req: Request) {
  const cookie = req.headers.get("cookie")?.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`))?.[1];
  const session = await readSession(cookie ? decodeURIComponent(cookie) : undefined);
  const [user] = session && session.uid !== 0 ? await db().select().from(schema.users).where(eq(schema.users.id, session.uid)) : [];
  if (!session || (session.uid !== 0 && !user)) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
  if (session.uid === 0) return NextResponse.redirect(new URL("/", req.url));
  const role = user.role === "member" ? "member" : "waitlist";
  if (role === "member") await ensureWorkspace(user);
  const res = NextResponse.redirect(new URL(role === "member" ? "/" : "/espera", req.url));
  res.cookies.set(SESSION_COOKIE, await createSession({ uid: user.id, email: user.email, role }), sessionCookieOptions);
  return res;
}
