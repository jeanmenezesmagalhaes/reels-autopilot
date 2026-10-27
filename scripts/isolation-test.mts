// Isolation test for multi-user (docs/PLANO-MULTIUSUARIO.md): two people, A and B,
// each with their own content; B must never see or reach A's. Runs against a running
// app and its database, and only ever touches rows it creates (cleaned up at the end).
// Use a test branch, never production:
//   DATABASE_URL=<test branch> APP_URL=http://localhost:3000 SESSION_SECRET=... \
//     npx tsx scripts/isolation-test.mts --test-db
import { neon } from "@neondatabase/serverless";
import { createSession } from "../src/lib/session";

if (!process.argv.includes("--test-db")) throw new Error("pass --test-db to confirm DATABASE_URL is a test branch");
const { DATABASE_URL, APP_URL, PIPELINE_SECRET } = process.env;
if (!DATABASE_URL || !APP_URL) throw new Error("DATABASE_URL and APP_URL must be set");
const sql = neon(DATABASE_URL);
const run = Date.now().toString(36);
const tag = (who: string) => `ISOLATION-${who}-${run}`;

type Person = { userId: number; workspaceId: number; videoId: number; variantId: number; cookie: string };
const failures: string[] = [];
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(what);
};

async function person(who: string, role = "member"): Promise<Person> {
  const email = `isolation-${who.toLowerCase()}-${run}@test.invalid`;
  const [{ id: userId }] = (await sql.query("insert into users (email, name, role) values ($1, $2, $3) returning id", [email, tag(who), role])) as { id: number }[];
  const [{ id: workspaceId }] = (await sql.query("insert into workspaces (name) values ($1) returning id", [tag(who)])) as { id: number }[];
  await sql.query("insert into members (workspace_id, user_id) values ($1, $2)", [workspaceId, userId]);
  const [{ id: videoId }] = (await sql.query(
    "insert into videos (workspace_id, slug, title, stage, raw_url) values ($1, $2, $3, 'uploaded', 'https://example.invalid/raw.mp4') returning id",
    [workspaceId, `isolation-${run}`, `${tag(who)}-video`],
  )) as { id: number }[];
  const [{ id: variantId }] = (await sql.query(
    "insert into variants (workspace_id, video_id, label, blob_url, caption) values ($1, $2, 'v1', 'https://example.invalid/v1.mp4', $3) returning id",
    [workspaceId, videoId, `${tag(who)}-caption`],
  )) as { id: number }[];
  await sql.query("insert into ideas (workspace_id, title) values ($1, $2)", [workspaceId, `${tag(who)}-idea`]);
  await sql.query(
    "insert into connections (workspace_id, kind, provider, method, label, external_id, secret) values ($1, 'instagram', 'instagram', 'oauth', $2, $3, 'not-a-token'), ($1, 'llm', 'anthropic', 'api_key', $4, 'anthropic', 'not-a-key')",
    [workspaceId, `@${tag(who)}-ig`, `ig-${who}-${run}`, `…${tag(who)}-key`],
  );
  await sql.query("insert into workspace_settings (workspace_id, key, value) values ($1, 'learnings', $2)", [workspaceId, `${tag(who)}-learnings`]);
  const cookie = `session=${encodeURIComponent(await createSession({ uid: userId, email, role: "member" }))}`;
  return { userId, workspaceId, videoId, variantId, cookie };
}

async function get(path: string, cookie?: string, headers: Record<string, string> = {}) {
  const res = await fetch(new URL(path, APP_URL), { headers: { ...(cookie ? { cookie } : {}), ...headers }, redirect: "manual" });
  return { status: res.status, location: res.headers.get("location") ?? "", body: await res.text() };
}

const created: Person[] = [];
try {
  const a = await person("A");
  const b = await person("B");
  const w = await person("W", "waitlist"); // let in once, access taken away since
  created.push(a, b, w);

  for (const page of ["/", "/?view=lista", "/?view=resultados", "/novo", "/ajustes"]) {
    const { status, body } = await get(page, b.cookie);
    check(status === 200, `B opens ${page}`);
    check(!body.includes(tag("A")), `B sees nothing of A on ${page}`);
  }
  const home = await get("/", b.cookie);
  check(home.body.includes(`${tag("B")}-video`), "B sees own video on the board");
  check((await get("/ajustes", b.cookie)).body.includes(`@${tag("B")}-ig`), "B sees own Instagram in Ajustes");
  check((await get(`/conteudo/${a.videoId}`, b.cookie)).status === 404, "B gets 404 on A's content page");
  check((await get(`/conteudo/${b.videoId}`, b.cookie)).status === 200, "B opens own content page");

  // Access taken away: the 30-day cookie still says member, the database says waitlist.
  const gone = await get("/", w.cookie);
  check(gone.status === 307 && gone.location.includes("/api/auth/refresh"), "removed member is sent to refresh");
  const refreshed = await get("/api/auth/refresh", w.cookie);
  check(refreshed.location.endsWith("/espera"), "refresh sends a removed member to the waitlist");

  // The Mac pipeline's shared secret reaches the home workspace only.
  if (PIPELINE_SECRET) {
    const inbox = await get("/api/inbox", undefined, { authorization: `Bearer ${PIPELINE_SECRET}` });
    check(inbox.status === 200, "pipeline reads its inbox");
    check(!inbox.body.includes(tag("A")) && !inbox.body.includes(tag("B")), "pipeline inbox has no other workspace's uploads");
    const report = await get("/api/report", undefined, { authorization: `Bearer ${PIPELINE_SECRET}` });
    check(!report.body.includes(tag("A")) && !report.body.includes(tag("B")), "pipeline report has no other workspace's data");
  }
  check((await get("/api/inbox", undefined, { authorization: "Bearer wrong" })).status === 401, "wrong pipeline secret is refused");
} finally {
  for (const p of created) {
    await sql.query("delete from workspaces where id = $1", [p.workspaceId]);
    await sql.query("delete from users where id = $1", [p.userId]);
  }
}

console.log(failures.length ? `\n${failures.length} failed` : "\nall passed");
process.exit(failures.length ? 1 : 0);
