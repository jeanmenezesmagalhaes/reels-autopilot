// One-time setup on the creator's Mac:
//   1. connect the creator's own AI (Claude Code, and optionally ChatGPT via Codex)
//      with each tool's official browser login: the creator's account, tokens and limits
//   2. create the video folders
//   3. schedule editing (hourly) and analysis (daily 05:30) with launchd
//   npm run setup
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = async (q: string, def = true) => {
  const a = (await rl.question(`${q} ${def ? "[S/n]" : "[s/N]"} `)).trim().toLowerCase();
  return a ? a.startsWith("s") || a.startsWith("y") : def;
};
const has = (cmd: string) => spawnSync("which", [cmd]).status === 0;
const run = (cmd: string, args: string[]) => spawnSync(cmd, args, { stdio: "inherit" }).status === 0;
const repo = process.cwd();

console.log("\nReels Autopilot · configuração do Mac\n");

// 0. Basics
if (!has("ffmpeg")) {
  console.log("• ffmpeg não encontrado (necessário para editar).");
  if (has("brew") && (await ask("  Instalar com Homebrew agora?"))) run("brew", ["install", "ffmpeg"]);
  else console.log("  Instale depois: brew install ffmpeg");
}
if (!existsSync(join(repo, ".env.local"))) {
  console.log("• Falta .env.local (ligação com o painel). Rode: npx vercel link && npx vercel env pull .env.local");
}

// 1. Claude (recommended)
console.log("\n1. Claude (recomendado)");
if (!has("claude")) {
  if (await ask("  Instalar o Claude Code (instalador oficial da Anthropic)?")) {
    run("/bin/bash", ["-c", "curl -fsSL https://claude.ai/install.sh | bash"]);
  }
}
if (has("claude")) {
  const status = spawnSync("claude", ["auth", "status"], { encoding: "utf8" });
  if (/"loggedIn":\s*true/.test(status.stdout)) console.log("  ✓ Claude conectado");
  else {
    console.log("  Abrindo o login do Claude no navegador. Entra com a tua conta.");
    run("claude", ["auth", "login"]);
  }
}

// 2. ChatGPT (optional fallback)
console.log("\n2. ChatGPT (opcional, reserva quando o Claude bater limite)");
if (await ask("  Conectar o ChatGPT também?", false)) {
  if (!has("codex")) run("npm", ["install", "-g", "@openai/codex@0.164.0"]);
  if (has("codex")) {
    if (spawnSync("codex", ["login", "status"]).status === 0) console.log("  ✓ ChatGPT conectado");
    else {
      console.log("  Abrindo o login do ChatGPT no navegador. Entra com a tua conta.");
      run("codex", ["login"]);
    }
  }
}

// 3. Folders
const root = join(homedir(), "Movies", "ReelsAutopilot");
for (const d of ["01-cru", "02-editando", "03-prontos", "04-na-fila"]) mkdirSync(join(root, d), { recursive: true });
console.log(`\n3. ✓ Pastas em ${root} (larga os vídeos em 01-cru)`);

// 4. Schedule with launchd (PATH captured now, so node/claude/codex resolve the same way)
console.log("\n4. Agendamento");
if (await ask("  Editar sozinho de hora em hora e analisar todo dia às 05:30?")) {
  const agents = join(homedir(), "Library", "LaunchAgents");
  const logs = join(homedir(), "Library", "Logs", "ReelsAutopilot");
  mkdirSync(agents, { recursive: true });
  mkdirSync(logs, { recursive: true });
  const uid = String(process.getuid?.() ?? "");
  const jobs = [
    { label: "app.reelsautopilot.edit", task: "edit", interval: "<dict><key>Minute</key><integer>17</integer></dict>" },
    {
      label: "app.reelsautopilot.analyze",
      task: "analyze",
      interval: "<dict><key>Hour</key><integer>5</integer><key>Minute</key><integer>30</integer></dict>",
    },
  ];
  for (const j of jobs) {
    const plist = join(agents, `${j.label}.plist`);
    const command = `cd '${repo}' && npm run -s pipeline:run -- ${j.task} >> '${join(logs, `${j.task}.log`)}' 2>&1`;
    writeFileSync(
      plist,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${j.label}</string>
  <key>ProgramArguments</key><array><string>/bin/zsh</string><string>-lc</string><string>${command}</string></array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>${process.env.PATH}</string></dict>
  <key>StartCalendarInterval</key>${j.interval}
</dict></plist>
`,
    );
    spawnSync("launchctl", ["bootout", `gui/${uid}`, plist]);
    spawnSync("launchctl", ["bootstrap", `gui/${uid}`, plist]);
  }
  console.log(`  ✓ Agendado. Logs em ${logs}`);
}

// 5. Helper for the "Conectar meu Claude/ChatGPT" buttons in Ajustes
console.log("\n5. Assistente do Mac (botões de conectar em Ajustes)");
run("npm", ["run", "-s", "setup:helper"]);

// 6. Tell the dashboard which AI is connected
console.log("\n6. Avisando o painel…");
run("npm", ["run", "-s", "pipeline:run", "--", "ping"]);
console.log("\nPronto. O painel mostra qual IA está conectada.\n");
rl.close();
