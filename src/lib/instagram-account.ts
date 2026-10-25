// Instagram accounts live in `connections` (kind "instagram"), token encrypted.
// The principal account (lowest priority) is the one the queue posts to; more
// accounts can be connected now and get assigned per creator in business workspaces.
import { and, asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { decryptSecret, encryptSecret } from "./secrets";

const { connections } = schema;

export async function listInstagramAccounts() {
  return db()
    .select()
    .from(connections)
    .where(eq(connections.kind, "instagram"))
    .orderBy(asc(connections.priority), asc(connections.id));
}

export async function getIgAccount() {
  const [row] = await listInstagramAccounts();
  if (!row) return undefined;
  return {
    id: row.id,
    token: decryptSecret(row.secret),
    userId: row.externalId,
    username: row.label.replace(/^@/, ""),
    refreshedAt: row.refreshedAt,
  };
}

export async function saveIgToken(id: number, token: string) {
  await db()
    .update(connections)
    .set({ secret: encryptSecret(token), refreshedAt: new Date(), status: "ok", statusDetail: null, checkedAt: new Date() })
    .where(eq(connections.id, id));
}

export async function markIgStatus(id: number, ok: boolean, detail?: string) {
  await db()
    .update(connections)
    .set({ status: ok ? "ok" : "error", statusDetail: ok ? null : (detail ?? null), checkedAt: new Date() })
    .where(eq(connections.id, id));
}

// Connecting the same account again just replaces its token; a new account goes last.
export async function saveIgAccount(a: { token: string; userId: string; username?: string }) {
  const [{ next }] = await db()
    .select({ next: sql<number>`coalesce(max(${connections.priority}) + 1, 0)::int` })
    .from(connections)
    .where(eq(connections.kind, "instagram"));
  await db()
    .insert(connections)
    .values({
      kind: "instagram",
      provider: "instagram",
      method: "oauth",
      label: `@${a.username ?? a.userId}`,
      externalId: a.userId,
      secret: encryptSecret(a.token),
      priority: next,
    })
    .onConflictDoUpdate({
      target: [connections.provider, connections.externalId],
      set: {
        label: `@${a.username ?? a.userId}`,
        secret: encryptSecret(a.token),
        status: "ok",
        statusDetail: null,
        refreshedAt: new Date(),
        checkedAt: new Date(),
      },
    });
}

export async function makePrincipalInstagram(id: number) {
  const rows = await listInstagramAccounts();
  const ordered = [rows.find((r) => r.id === id), ...rows.filter((r) => r.id !== id)].filter(Boolean);
  for (const [i, r] of ordered.entries()) {
    await db().update(connections).set({ priority: i }).where(eq(connections.id, r!.id));
  }
}

export async function removeInstagram(id: number) {
  await db().delete(connections).where(and(eq(connections.id, id), eq(connections.kind, "instagram")));
}
