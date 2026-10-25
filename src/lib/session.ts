// Signed session cookie for the single dashboard user. Works on the Edge
// runtime (middleware) and in Node (server actions) via Web Crypto.
// The HMAC key is DASHBOARD_PASSWORD, so changing the password logs out every session.
import { safeEqual } from "./auth";

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;

const encoder = new TextEncoder();

async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSession(secret: string) {
  const exp = Date.now() + SESSION_MAX_AGE_S * 1000;
  return `v1.${exp}.${await hmac(secret, `v1.${exp}`)}`;
}

export async function isValidSession(token: string | undefined, secret: string | undefined) {
  if (!token || !secret) return false;
  const [version, exp, sig] = token.split(".");
  if (version !== "v1" || !exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(secret, `v1.${exp}`));
}
