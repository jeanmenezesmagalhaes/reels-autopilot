// Applies drizzle/0001_workspaces.sql (multi-user, phase 1) in one transaction.
// Safe to run twice: it stops if the workspaces table already exists.
//   DATABASE_URL=<branch url> npx tsx scripts/migrate-workspaces.mts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = neon(url);

const [{ exists }] = (await sql.query("select to_regclass('public.workspaces') is not null as exists")) as { exists: boolean }[];
if (exists) {
  console.log("workspaces already exists, nothing to do");
  process.exit(0);
}

const statements = readFileSync(join(process.cwd(), "drizzle", "0001_workspaces.sql"), "utf8")
  .split("\n")
  .filter((line) => !line.startsWith("--"))
  .join("\n")
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter(Boolean);

await sql.transaction(statements.map((s) => sql.query(s)));

const counts = (await sql.query(
  `select (select count(*) from workspaces) as workspaces, (select count(*) from members) as members,
          (select count(*) from videos) as videos, (select count(*) from variants) as variants,
          (select count(*) from ideas) as ideas, (select count(*) from connections) as connections,
          (select count(*) from workspace_settings) as settings`,
)) as Record<string, string>[];
console.log(`applied ${statements.length} statements`, counts[0]);
