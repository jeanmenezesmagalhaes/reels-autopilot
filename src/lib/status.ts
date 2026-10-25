// Connection state shared by the dashboard, the onboarding checklist and Ajustes.
import { getSetting } from "@/db";
import { listInstagramAccounts } from "./instagram-account";
import { listLlmConnections } from "./llm";

export type Runner = { provider: "claude" | "codex" | "none"; ok: boolean; at: number };

export async function connectionStatus() {
  const [instagram, llms, runnerRaw] = await Promise.all([listInstagramAccounts(), listLlmConnections(), getSetting("runner")]);
  const runner = runnerRaw ? (JSON.parse(runnerRaw) as Runner) : undefined;
  const macAi = runner && runner.provider !== "none" && runner.ok ? runner : undefined;
  return {
    instagram,
    principalIg: instagram[0],
    llms,
    runner: macAi,
    aiReady: llms.length > 0 || Boolean(macAi),
  };
}

export const aiLabel = (provider: string) =>
  ({ claude: "Claude", codex: "ChatGPT", anthropic: "Claude", openai: "ChatGPT", google: "Gemini", openrouter: "OpenRouter" })[provider] ??
  provider;
