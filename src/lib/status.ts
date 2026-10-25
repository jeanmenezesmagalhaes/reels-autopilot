// Connection state shared by the dashboard, the onboarding checklist and Ajustes.
import { getSetting } from "@/db";
import { listInstagramAccounts } from "./instagram-account";
import { listLlmConnections } from "./llm";

export type Runner = { provider: "claude" | "codex" | "none"; ok: boolean; at: number; connected?: ("claude" | "codex")[] };

export async function connectionStatus() {
  const [instagram, llms, runnerRaw] = await Promise.all([listInstagramAccounts(), listLlmConnections(), getSetting("runner")]);
  const runner = runnerRaw ? (JSON.parse(runnerRaw) as Runner) : undefined;
  const macAi = runner && runner.provider !== "none" && runner.ok ? runner : undefined;
  // Subscriptions seen on the Mac in the last 2 days (older pings mean the helper is off).
  const fresh = runner && Date.now() - runner.at < 2 * 86_400_000;
  const subscriptions = new Set(fresh ? (runner.connected ?? (macAi ? [macAi.provider as "claude" | "codex"] : [])) : []);
  return {
    instagram,
    principalIg: instagram[0],
    llms,
    runner: macAi,
    lastSeen: runner?.at,
    subscriptions,
    aiReady: llms.length > 0 || subscriptions.size > 0,
  };
}

export const aiLabel = (provider: string) =>
  ({ claude: "Claude", codex: "ChatGPT", anthropic: "Claude", openai: "ChatGPT", google: "Gemini" })[provider] ??
  provider;
