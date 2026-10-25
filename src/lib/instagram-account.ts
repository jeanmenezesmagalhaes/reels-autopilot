// The connected Instagram account lives in `settings`: user id, username and the
// long-lived token (encrypted). It is set by "Conectar Instagram" and never shown.
import { inArray } from "drizzle-orm";
import { db, getSetting, schema, setSetting } from "@/db";
import { decryptSecret, encryptSecret } from "./secrets";

const KEYS = ["ig_access_token", "ig_user_id", "ig_username", "ig_token_refreshed_at", "ig_token_failing_since"];

export async function getIgAccount() {
  const [token, userId, username] = await Promise.all([
    getSetting("ig_access_token"),
    getSetting("ig_user_id"),
    getSetting("ig_username"),
  ]);
  if (!token || !userId) return undefined;
  return { token: decryptSecret(token), userId, username };
}

export async function saveIgToken(token: string) {
  await setSetting("ig_access_token", encryptSecret(token));
}

export async function saveIgAccount(a: { token: string; userId: string; username?: string }) {
  await saveIgToken(a.token);
  await setSetting("ig_user_id", a.userId);
  await setSetting("ig_username", a.username ?? "");
  await setSetting("ig_token_refreshed_at", String(Date.now()));
  await setSetting("ig_token_failing_since", "");
}

export async function clearIgAccount() {
  await db().delete(schema.settings).where(inArray(schema.settings.key, KEYS));
}
