import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq } from "drizzle-orm";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return drizzle(neon(url), { schema });
}

let cached: ReturnType<typeof createDb> | undefined;

// Lazy so `next build` works without a database configured.
export function db() {
  cached ??= createDb();
  return cached;
}

// Server-wide settings (login guard, leases). Anything that belongs to a creator goes
// through getWorkspaceSetting instead.
export async function getSetting(key: string): Promise<string | undefined> {
  const [row] = await db().select().from(schema.settings).where(eq(schema.settings.key, key));
  return row?.value;
}

export async function setSetting(key: string, value: string) {
  await db()
    .insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
}

export async function getWorkspaceSetting(workspaceId: number, key: string): Promise<string | undefined> {
  const t = schema.workspaceSettings;
  const [row] = await db()
    .select({ value: t.value })
    .from(t)
    .where(and(eq(t.workspaceId, workspaceId), eq(t.key, key)));
  return row?.value;
}

export async function setWorkspaceSetting(workspaceId: number, key: string, value: string) {
  const t = schema.workspaceSettings;
  await db()
    .insert(t)
    .values({ workspaceId, key, value })
    .onConflictDoUpdate({ target: [t.workspaceId, t.key], set: { value, updatedAt: new Date() } });
}

export { schema };
