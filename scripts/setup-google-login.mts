// Turns on "Continue with Google": reads the OAuth client JSON downloaded from
// Google Cloud (newest ~/Downloads/client_secret_*.json, or a path you pass),
// stores the client id and secret in Vercel without printing them, and redeploys.
//   npm run setup:google [-- /path/to/client_secret.json]
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function newestDownload() {
  const dir = join(homedir(), "Downloads");
  const files = readdirSync(dir)
    .filter((f) => /^client_secret.*\.json$/.test(f))
    .map((f) => join(dir, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!files.length) throw new Error("No client_secret*.json in ~/Downloads. Download it from Google Cloud first.");
  return files[0];
}

const file = process.argv[2] ?? newestDownload();
const json = JSON.parse(readFileSync(file, "utf8"));
const web = json.web;
if (!web?.client_id || !web?.client_secret) throw new Error(`${file} is not a "Web application" OAuth client.`);

function setEnv(name: string, value: string, sensitive: boolean) {
  for (const env of ["production", "development"]) {
    const args = ["vercel", "env", "add", name, env, "--force", ...(sensitive && env === "production" ? ["--sensitive"] : [])];
    const run = spawnSync("npx", args, { input: value, encoding: "utf8" });
    if (run.status !== 0) throw new Error(`vercel env add ${name} ${env} failed:\n${run.stderr}`);
  }
  console.log(`✓ ${name}`);
}

setEnv("GOOGLE_CLIENT_ID", web.client_id, false);
setEnv("GOOGLE_CLIENT_SECRET", web.client_secret, true);
console.log("Deploying…");
const deploy = spawnSync("npx", ["vercel", "deploy", "--prod", "--yes"], { stdio: "inherit" });
if (deploy.status !== 0) process.exit(deploy.status ?? 1);
spawnSync("npx", ["vercel", "env", "pull", ".env.local", "--yes"], { stdio: "ignore" });
console.log("✓ Google sign-in is on. Open the app and choose “Continue with Google”.");
console.log(`You can delete ${file} now.`);
