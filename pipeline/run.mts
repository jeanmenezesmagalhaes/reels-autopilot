// Runs a routine (edit or analyze) with the creator's own AI app, logged in through
// its official CLI: Claude Code first, then Codex (ChatGPT) if Claude is unavailable
// or out of usage. Nothing here stores or handles AI credentials.
//   npm run pipeline:run -- edit
//   npm run pipeline:run -- analyze
//   npm run pipeline:run -- ping      (only reports which AI is connected)
//   npm run pipeline:run -- sync      (downloads dashboard uploads/redo requests, then ping)
import { spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline as streamPipeline } from "node:stream/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const task = process.argv[2];
const prompts: Record<string, string> = { edit: "EDIT_PROMPT.md", analyze: "ANALYZE_PROMPT.md" };
if (!prompts[task] && task !== "ping" && task !== "sync") throw new Error("usage: npm run pipeline:run -- edit|analyze|ping|sync");

const prompt =
  task === "ping" || task === "sync"
    ? ""
    : `Follow these instructions exactly. Working directory: ${process.cwd()}.\n\n` +
      readFileSync(join(import.meta.dirname, prompts[task]), "utf8");

// The ChatGPT desktop app ships its own Codex CLI (already signed in with ChatGPT);
// use it when `codex` isn't on PATH.
const BUNDLED_CODEX = "/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex";
const codexCmd = spawnSync("which", ["codex"]).status === 0 ? "codex" : existsSync(BUNDLED_CODEX) ? BUNDLED_CODEX : "codex";

const providers: Record<string, { cmd: string; args: string[] }> = {
  claude: {
    cmd: "claude",
    args: ["-p", prompt, "--permission-mode", "acceptEdits", "--allowedTools", "Bash", "Read", "Write", "Edit", "Glob", "Grep", "Skill"],
  },
  codex: { cmd: codexCmd, args: ["exec", "--full-auto", prompt] },
};

// Usage-limit and auth failures mean "try the next provider"; anything else is a real error.
const SWITCH = /usage limit|rate limit|quota|limit reached|credit balance|not logged in|please run .*login|ENOENT/i;
let connectedList: string[] = [];
async function heartbeat(provider: string, ok: boolean) {
  const { APP_URL, PIPELINE_SECRET } = process.env;
  if (!APP_URL || !PIPELINE_SECRET) return;
  await fetch(new URL("/api/report", APP_URL), {
    method: "POST",
    headers: { authorization: `Bearer ${PIPELINE_SECRET}`, "content-type": "application/json" },
    body: JSON.stringify({ heartbeat: { provider, task, ok, connected: connectedList } }),
  }).catch(() => undefined);
}

const has = (cmd: string) => spawnSync("which", [cmd]).status === 0;

// Only providers whose official CLI is installed and logged in on this Mac.
function connected(name: string) {
  const check =
    name === "claude"
      ? spawnSync("claude", ["auth", "status"], { encoding: "utf8" })
      : spawnSync(codexCmd, ["login", "status"], { encoding: "utf8" });
  if (check.error || check.status !== 0) return false;
  return name === "claude" ? /"loggedIn":\s*true/.test(check.stdout) : true;
}
// A Claude key connected in Ajustes also powers the editor when this Mac has no Claude login.
// It lives only in the child process environment, never on disk.
const childEnv: NodeJS.ProcessEnv = { ...process.env };
async function claudeKeyFromAjustes() {
  const { APP_URL, PIPELINE_SECRET } = process.env;
  if (!APP_URL || !PIPELINE_SECRET) return false;
  const res = await fetch(new URL("/api/llm/editor", APP_URL), { headers: { authorization: `Bearer ${PIPELINE_SECRET}` } }).catch(() => undefined);
  const key = res?.ok ? ((await res.json()) as { anthropic: string | null }).anthropic : null;
  if (key) childEnv.ANTHROPIC_API_KEY = key;
  return Boolean(key);
}

const order: string[] = [];
for (const p of (process.env.AI_PROVIDERS ?? "claude,codex").split(",").map((x) => x.trim())) {
  if (!providers[p]) continue;
  if (connected(p) || (p === "claude" && has("claude") && (await claudeKeyFromAjustes()))) order.push(p);
}

const root = process.env.REELS_DIR ?? join(homedir(), "Movies", "ReelsAutopilot");

// Pull work from the dashboard: videos uploaded there (saved to 01-cru with their
// brief next to them) and versions the creator asked to redo (revisoes.json).
async function syncInbox() {
  const { APP_URL, PIPELINE_SECRET } = process.env;
  if (!APP_URL || !PIPELINE_SECRET) return;
  const headers = { authorization: `Bearer ${PIPELINE_SECRET}`, "content-type": "application/json" };
  const res = await fetch(new URL("/api/inbox", APP_URL), { headers }).catch(() => undefined);
  if (!res?.ok) return;
  const inbox = (await res.json()) as {
    uploads: { slug: string; title: string; brief: string | null; baseCaption: string | null; rawUrl: string }[];
    revisions: { slug: string; title: string; label: string; caption: string; note: string | null }[];
  };
  mkdirSync(join(root, "01-cru"), { recursive: true });
  for (const u of inbox.uploads) {
    const ext = (u.rawUrl.split("?")[0].match(/\.(mov|mp4|m4v)$/i)?.[1] ?? "mp4").toLowerCase();
    const file = await fetch(u.rawUrl).catch(() => undefined);
    if (!file?.ok || !file.body) continue;
    await streamPipeline(Readable.fromWeb(file.body as never), createWriteStream(join(root, "01-cru", `${u.slug}.${ext}`)));
    writeFileSync(
      join(root, "01-cru", `${u.slug}.brief.json`),
      JSON.stringify({ slug: u.slug, title: u.title, brief: u.brief, baseCaption: u.baseCaption }, null, 2),
    );
    await fetch(new URL("/api/inbox/claim", APP_URL), { method: "POST", headers, body: JSON.stringify({ slug: u.slug }) });
    console.log(`↓ ${u.title}`);
  }
  writeFileSync(join(root, "revisoes.json"), JSON.stringify(inbox.revisions, null, 2));
}

// Don't spend the creator's AI limits when there is nothing to edit.
function nothingToEdit() {
  const has = (dir: string, re: RegExp) => existsSync(join(root, dir)) && readdirSync(join(root, dir)).some((f) => re.test(f));
  const revisions = existsSync(join(root, "revisoes.json")) && JSON.parse(readFileSync(join(root, "revisoes.json"), "utf8")).length > 0;
  return !has("01-cru", /\.(mov|mp4|m4v)$/i) && !has("02-editando", /^[^.]/) && !revisions;
}

if (task === "edit" || task === "sync") await syncInbox();

connectedList = order;

if (task === "ping" || task === "sync" || (task === "edit" && nothingToEdit())) {
  await heartbeat(order[0] ?? "none", order.length > 0);
  console.log(order.length ? `AI connected: ${order.join(" → ")}` : "No AI connected. Run: npm run setup");
  if (task === "edit") console.log("Nothing to edit.");
  process.exit(order.length ? 0 : 1);
}


for (const name of order) {
  const { cmd, args } = providers[name];
  console.log(`→ ${task} with ${name}`);
  const run = spawnSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024, env: childEnv });
  const output = `${run.stdout ?? ""}\n${run.stderr ?? ""}\n${run.error?.message ?? ""}`;
  process.stdout.write(run.stdout ?? "");
  if (run.status === 0 && !SWITCH.test(run.stderr ?? "")) {
    await heartbeat(name, true);
    process.exit(0);
  }
  if (!SWITCH.test(output)) {
    console.error(output.slice(-2000));
    await heartbeat(name, false);
    process.exit(run.status ?? 1);
  }
  console.log(`  ${name} unavailable, trying the next provider`);
}
await heartbeat("none", false);
console.error("No AI provider available. Log in with `claude` or `codex login`.");
process.exit(1);
