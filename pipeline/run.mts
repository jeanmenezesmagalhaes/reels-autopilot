// Runs a routine (edit or analyze) with the creator's own AI app, logged in through
// its official CLI: Claude Code first, then Codex (ChatGPT) if Claude is unavailable
// or out of usage. Nothing here stores or handles AI credentials.
//   npm run pipeline:run -- edit
//   npm run pipeline:run -- analyze
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const task = process.argv[2];
const prompts: Record<string, string> = { edit: "EDIT_PROMPT.md", analyze: "ANALYZE_PROMPT.md" };
if (!prompts[task]) throw new Error("usage: npm run pipeline:run -- edit|analyze");

const prompt =
  `Follow these instructions exactly. Working directory: ${process.cwd()}.\n\n` +
  readFileSync(join(import.meta.dirname, prompts[task]), "utf8");

const providers: Record<string, { cmd: string; args: string[] }> = {
  claude: {
    cmd: "claude",
    args: ["-p", prompt, "--permission-mode", "acceptEdits", "--allowedTools", "Bash", "Read", "Write", "Edit", "Glob", "Grep", "Skill"],
  },
  codex: { cmd: "codex", args: ["exec", "--full-auto", prompt] },
};

// Usage-limit and auth failures mean "try the next provider"; anything else is a real error.
const SWITCH = /usage limit|rate limit|quota|limit reached|credit balance|not logged in|please run .*login|ENOENT/i;
const order = (process.env.AI_PROVIDERS ?? "claude,codex").split(",").map((p) => p.trim()).filter((p) => providers[p]);

async function heartbeat(provider: string, ok: boolean) {
  const { APP_URL, PIPELINE_SECRET } = process.env;
  if (!APP_URL || !PIPELINE_SECRET) return;
  await fetch(new URL("/api/report", APP_URL), {
    method: "POST",
    headers: { authorization: `Bearer ${PIPELINE_SECRET}`, "content-type": "application/json" },
    body: JSON.stringify({ heartbeat: { provider, task, ok } }),
  }).catch(() => undefined);
}

for (const name of order) {
  const { cmd, args } = providers[name];
  console.log(`→ ${task} with ${name}`);
  const run = spawnSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
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
