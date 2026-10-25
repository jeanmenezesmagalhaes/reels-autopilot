"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSetting, setSetting } from "@/db";
import { safeEqual } from "@/lib/auth";
import { createSession, SESSION_COOKIE, SESSION_MAX_AGE_S } from "@/lib/session";

const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;

export type LoginState = { error?: "wrong" | "locked" } | null;

// Brute-force guard: after MAX_FAILURES wrong passwords in WINDOW_MS, refuse every
// attempt until the window passes. One user, so one global counter is enough.
async function failures() {
  const raw = await getSetting("login_failures");
  const parsed = raw ? (JSON.parse(raw) as { count: number; since: number }) : undefined;
  return parsed && Date.now() - parsed.since < WINDOW_MS ? parsed : { count: 0, since: Date.now() };
}

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const password = process.env.DASHBOARD_PASSWORD;
  const given = form.get("password");
  const f = await failures();
  if (f.count >= MAX_FAILURES) return { error: "locked" };

  if (!password || typeof given !== "string" || !safeEqual(given, password)) {
    await setSetting("login_failures", JSON.stringify({ count: f.count + 1, since: f.since }));
    await new Promise((r) => setTimeout(r, 700)); // slow down guessing
    return { error: f.count + 1 >= MAX_FAILURES ? "locked" : "wrong" };
  }

  await setSetting("login_failures", JSON.stringify({ count: 0, since: Date.now() }));
  (await cookies()).set(SESSION_COOKIE, await createSession(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
