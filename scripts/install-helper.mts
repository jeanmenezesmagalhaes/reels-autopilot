// Installs "Reels Autopilot.app" in ~/Applications: a tiny helper that handles
// reelsautopilot:// links from the dashboard, so "Conectar meu Claude/ChatGPT" in
// Ajustes opens the official sign-in on this Mac. It only runs fixed commands;
// nothing from the link is ever executed.
//   npm run setup:helper
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const repo = process.cwd();
const PATH = process.env.PATH ?? "/usr/bin:/bin";
const apps = join(homedir(), "Applications");
const app = join(apps, "Reels Autopilot.app");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const done = "echo && echo 'Pronto. Pode fechar esta janela e voltar ao painel.'";

const script = `
property repoPath : "${esc(repo)}"
property pathEnv : "${esc(PATH)}"

on runInTerminal(cmd)
  tell application "Terminal"
    activate
    do script "cd " & quoted form of repoPath & " && export PATH=" & quoted form of pathEnv & " && " & cmd
  end tell
end runInTerminal

on open location theURL
  if theURL is "reelsautopilot://connect/claude" then
    runInTerminal("claude auth login && npm run -s pipeline:run -- ping && ${esc(done)}")
  else if theURL is "reelsautopilot://connect/chatgpt" then
    runInTerminal("C=$(command -v codex || echo /Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex); ([ -x \\"$C\\" ] || npm install -g @openai/codex@0.164.0) && C=$(command -v codex || echo /Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex) && (\\"$C\\" login status >/dev/null 2>&1 || \\"$C\\" login) && npm run -s pipeline:run -- ping && ${esc(done)}")
  else if theURL is "reelsautopilot://ping" then
    do shell script "cd " & quoted form of repoPath & " && PATH=" & quoted form of pathEnv & " npm run -s pipeline:run -- ping >/dev/null 2>&1 &"
  end if
end open location

on run
  do shell script "cd " & quoted form of repoPath & " && PATH=" & quoted form of pathEnv & " npm run -s pipeline:run -- ping >/dev/null 2>&1 &"
end run
`;

mkdirSync(apps, { recursive: true });
rmSync(app, { recursive: true, force: true });
const dir = mkdtempSync(join(tmpdir(), "ra-helper-"));
const src = join(dir, "helper.applescript");
writeFileSync(src, script);
const built = spawnSync("osacompile", ["-o", app, src], { encoding: "utf8" });
if (built.status !== 0) throw new Error(built.stderr);

const plist = join(app, "Contents", "Info.plist");
const pb = (cmd: string) => spawnSync("/usr/libexec/PlistBuddy", ["-c", cmd, plist], { encoding: "utf8" });
pb("Set :CFBundleIdentifier app.reelsautopilot.helper");
pb("Add :CFBundleURLTypes array");
pb("Add :CFBundleURLTypes:0 dict");
pb("Add :CFBundleURLTypes:0:CFBundleURLName string app.reelsautopilot");
pb("Add :CFBundleURLTypes:0:CFBundleURLSchemes array");
pb("Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string reelsautopilot");
pb("Add :LSBackgroundOnly bool true");

const lsregister = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";
spawnSync(lsregister, ["-f", app]);
rmSync(dir, { recursive: true, force: true });
console.log(`✓ Assistente instalado em ${app}`);
console.log('  Em Ajustes, "Conectar meu Claude" e "Conectar meu ChatGPT" agora abrem o login aqui no Mac.');
