// Instagram accounts live in `connections` (kind "instagram"), token encrypted.
// The principal account (lowest priority) is the one the queue posts to; more
// accounts can be connected now and get assigned per creator in business workspaces.
// An account belongs to one workspace only (connections_instagram_once).
import { and, asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { decryptSecret, encryptSecret } from "./secrets";

const { connections } = schema;

export async function listInstagramAccounts(workspaceId: number) {
  return db()
    .select()
    .from(connections)
    .where(and(eq(connections.workspaceId, workspaceId), eq(connections.kind, "instagram")))
    .orderBy(asc(connections.priority), asc(connections.id));
}

export async function getIgAccount(workspaceId: number) {
  const [row] = await listInstagramAccounts(workspaceId);
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

export class InstagramTakenError extends Error {}

// Connecting the same account again just replaces its token; a new account goes last.
// An account already connected to someone else's dashboard is refused.
export async function saveIgAccount(workspaceId: number, a: { token: string; userId: string; username?: string }) {
  const label = `@${a.username ?? a.userId}`;
  const [existing] = await db()
    .select({ id: connections.id, workspaceId: connections.workspaceId })
    .from(connections)
    .where(and(eq(connections.kind, "instagram"), eq(connections.externalId, a.userId)));
  if (existing && existing.workspaceId !== workspaceId) throw new InstagramTakenError(label);
  if (existing) {
    await db()
      .update(connections)
      .set({ label, secret: encryptSecret(a.token), status: "ok", statusDetail: null, refreshedAt: new Date(), checkedAt: new Date() })
      .where(eq(connections.id, existing.id));
    return;
  }
  const [{ next }] = await db()
    .select({ next: sql<number>`coalesce(max(${connections.priority}) + 1, 0)::int` })
    .from(connections)
    .where(and(eq(connections.workspaceId, workspaceId), eq(connections.kind, "instagram")));
  await db()
    .insert(connections)
    .values({
      workspaceId,
      kind: "instagram",
      provider: "instagram",
      method: "oauth",
      label,
      externalId: a.userId,
      secret: encryptSecret(a.token),
      priority: next,
    });
}

export async function makePrincipalInstagram(workspaceId: number, id: number) {
  const rows = await listInstagramAccounts(workspaceId);
  if (!rows.some((r) => r.id === id)) return;
  const ordered = [rows.find((r) => r.id === id), ...rows.filter((r) => r.id !== id)].filter(Boolean);
  for (const [i, r] of ordered.entries()) {
    await db().update(connections).set({ priority: i }).where(eq(connections.id, r!.id));
  }
}

// The follower history goes with it, so whoever connects the account next starts fresh.
export async function removeInstagram(workspaceId: number, id: number) {
  const [gone] = await db()
    .delete(connections)
    .where(and(eq(connections.id, id), eq(connections.workspaceId, workspaceId), eq(connections.kind, "instagram")))
    .returning({ igUserId: connections.externalId });
  if (gone) await db().delete(schema.profileSnapshots).where(eq(schema.profileSnapshots.igUserId, gone.igUserId));
}
