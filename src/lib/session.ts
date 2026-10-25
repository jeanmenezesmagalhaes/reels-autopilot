// Signed session cookie. Works on the Edge runtime (middleware) and in Node
// (server actions, route handlers) via Web Crypto. Changing SESSION_SECRET
// logs out every session.
import { safeEqual } from "./auth";

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;

export type Role = "owner" | "waitlist";
export type Session = { uid: number; email: string; role: Role; exp: number };

const encoder = new TextEncoder();

export function sessionSecret() {
  return process.env.SESSION_SECRET ?? process.env.DASHBOARD_PASSWORD;
}

function b64url(text: string) {
  return btoa(String.fromCharCode(...encoder.encode(text)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(text: string) {
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSession(user: { uid: number; email: string; role: Role }) {
  const secret = sessionSecret();
  if (!secret) throw new Error("SESSION_SECRET is not set");
  const body = b64url(JSON.stringify({ ...user, exp: Date.now() + SESSION_MAX_AGE_S * 1000 }));
  return `v2.${body}.${await hmac(secret, `v2.${body}`)}`;
}

export async function readSession(token: string | undefined): Promise<Session | undefined> {
  const secret = sessionSecret();
  if (!token || !secret) return undefined;
  const [version, body, sig] = token.split(".");
  if (version !== "v2" || !body || !sig) return undefined;
  if (!safeEqual(sig, await hmac(secret, `v2.${body}`))) return undefined;
  try {
    const s = JSON.parse(fromB64url(body)) as Session;
    return s.exp > Date.now() && (s.role === "owner" || s.role === "waitlist") ? s : undefined;
  } catch {
    return undefined;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_S,
};
