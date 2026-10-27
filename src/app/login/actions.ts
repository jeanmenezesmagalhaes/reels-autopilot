"use server";

import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, getSetting, schema, setSetting } from "@/db";
import { safeEqual } from "@/lib/auth";
import { googleConfigured } from "@/lib/google";
import { createSession, readSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;

export type LoginState = { error?: "wrong" | "locked" } | null;

async function failures() {
  const raw = await getSetting("login_failures");
  const parsed = raw ? (JSON.parse(raw) as { count: number; since: number }) : undefined;
  return parsed && Date.now() - parsed.since < WINDOW_MS ? parsed : { count: 0, since: Date.now() };
}

// Password sign-in only exists until Google sign-in is configured (first-run fallback).
// Brute-force guard: after MAX_FAILURES wrong passwords in WINDOW_MS, refuse every attempt.
export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const password = process.env.DASHBOARD_PASSWORD;
  if (googleConfigured() || !password) return { error: "wrong" };
  const given = form.get("password");
  const f = await failures();
  if (f.count >= MAX_FAILURES) return { error: "locked" };

  if (typeof given !== "string" || !safeEqual(given, password)) {
    await setSetting("login_failures", JSON.stringify({ count: f.count + 1, since: f.since }));
    await new Promise((r) => setTimeout(r, 700)); // slow down guessing
    return { error: f.count + 1 >= MAX_FAILURES ? "locked" : "wrong" };
  }

  await setSetting("login_failures", JSON.stringify({ count: 0, since: Date.now() }));
  (await cookies()).set(SESSION_COOKIE, await createSession({ uid: 0, email: "owner", role: "member" }), sessionCookieOptions);
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

// Waitlist users can erase themselves; the owner account is never deleted from here.
export async function deleteMyData() {
  const session = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (session?.role === "waitlist") {
    await db()
      .delete(schema.users)
      .where(and(eq(schema.users.id, session.uid), eq(schema.users.role, "waitlist")));
  }
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login?excluido=1");
}
