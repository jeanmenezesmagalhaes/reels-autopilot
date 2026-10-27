// AI providers the creator connects in Ajustes, with their own key or account.
// `complete` tries them in the order the creator set and moves to the next one when
// a provider fails or runs out of quota, so analysis keeps working.
import Anthropic from "@anthropic-ai/sdk";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { decryptSecret, encryptSecret } from "./secrets";

const { connections } = schema;

export const LLM_PROVIDERS = {
  anthropic: { name: "Claude", keyPrefix: "sk-ant-", keyUrl: "https://console.anthropic.com/settings/keys" },
  openai: { name: "ChatGPT", keyPrefix: "sk-", keyUrl: "https://platform.openai.com/api-keys" },
  google: { name: "Gemini", keyPrefix: "AI", keyUrl: "https://aistudio.google.com/apikey" },
} as const;
export type LlmProvider = keyof typeof LLM_PROVIDERS;
export const isLlmProvider = (p: string): p is LlmProvider => p in LLM_PROVIDERS;

// Models are overridable per deploy; Claude defaults to the current Opus.
const MODELS = {
  anthropic: process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5",
  openai: process.env.OPENAI_MODEL ?? "gpt-5",
  google: process.env.GEMINI_MODEL ?? "gemini-2.5-pro",
};

async function ok(res: Response, provider: string) {
  if (!res.ok) throw new Error(`${provider} ${res.status}`);
  return res.json();
}

// Cheap authenticated call that proves the key works, without generating text.
export async function validateKey(provider: LlmProvider, key: string) {
  switch (provider) {
    case "anthropic":
      await new Anthropic({ apiKey: key, maxRetries: 0 }).models.list({ limit: 1 });
      return;
    case "openai":
      await ok(await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } }), provider);
      return;
    case "google":
      await ok(
        await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", { headers: { "x-goog-api-key": key } }),
        provider,
      );
      return;
  }
}

// The cron tick has a hard time limit; an analysis that runs longer is dropped and
// tried again on a later tick.
export const ANALYSIS_TIMEOUT_MS = 100_000;

async function callProvider(provider: LlmProvider, key: string, system: string, prompt: string): Promise<string> {
  switch (provider) {
    case "anthropic": {
      const client = new Anthropic({ apiKey: key, timeout: ANALYSIS_TIMEOUT_MS, maxRetries: 0 });
      const res = await client.beta.messages.create({
        model: MODELS.anthropic,
        max_tokens: 16000,
        output_config: { effort: "medium" },
        // On a safety decline the API retries on a fallback model inside the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system,
        messages: [{ role: "user", content: prompt }],
      });
      if (res.stop_reason === "refusal") throw new Error("anthropic refusal");
      return res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    }
    case "openai": {
      const json = await ok(
        await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          signal: AbortSignal.timeout(ANALYSIS_TIMEOUT_MS),
          headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
          body: JSON.stringify({
            model: MODELS[provider],
            messages: [
              { role: "system", content: system },
              { role: "user", content: prompt },
            ],
          }),
        }),
        provider,
      );
      return json.choices?.[0]?.message?.content ?? "";
    }
    case "google": {
      const json = await ok(
        await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELS.google}:generateContent`, {
          method: "POST",
          signal: AbortSignal.timeout(ANALYSIS_TIMEOUT_MS),
          headers: { "x-goog-api-key": key, "content-type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
          }),
        }),
        provider,
      );
      return json.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    }
  }
}

export async function listLlmConnections(workspaceId: number) {
  return db()
    .select()
    .from(connections)
    .where(and(eq(connections.workspaceId, workspaceId), eq(connections.kind, "llm")))
    .orderBy(asc(connections.priority), asc(connections.id));
}

export async function hasLlm(workspaceId: number) {
  return (await listLlmConnections(workspaceId)).length > 0;
}

// Tries each connected AI in order; a failing one is marked and skipped.
export async function complete(workspaceId: number, system: string, prompt: string) {
  const rows = await listLlmConnections(workspaceId);
  if (!rows.length) throw new Error("no AI connected");
  const errors: string[] = [];
  for (const row of rows) {
    if (!isLlmProvider(row.provider)) continue;
    try {
      const text = await callProvider(row.provider, decryptSecret(row.secret), system, prompt);
      await db().update(connections).set({ status: "ok", statusDetail: null, checkedAt: new Date() }).where(eq(connections.id, row.id));
      return { text, provider: row.provider };
    } catch (err) {
      const msg = err instanceof Anthropic.APIError ? `anthropic ${err.status}` : (err as Error).message;
      errors.push(msg);
      await db().update(connections).set({ status: "error", statusDetail: msg, checkedAt: new Date() }).where(eq(connections.id, row.id));
    }
  }
  throw new Error(`all AIs failed: ${errors.join("; ")}`);
}

export async function saveLlmKey(workspaceId: number, provider: LlmProvider, key: string) {
  const rows = await listLlmConnections(workspaceId);
  const existing = rows.find((r) => r.provider === provider);
  const values = {
    kind: "llm",
    provider,
    method: "api_key",
    label: `…${key.slice(-4)}`,
    externalId: provider,
    secret: encryptSecret(key),
    status: "ok",
    statusDetail: null,
    checkedAt: new Date(),
    refreshedAt: new Date(),
  };
  if (existing) await db().update(connections).set(values).where(eq(connections.id, existing.id));
  else await db().insert(connections).values({ ...values, workspaceId, priority: rows.length });
}

export async function removeLlm(workspaceId: number, id: number) {
  await db()
    .delete(connections)
    .where(and(eq(connections.id, id), eq(connections.workspaceId, workspaceId), eq(connections.kind, "llm")));
}

export async function moveLlm(workspaceId: number, id: number, direction: "up" | "down") {
  const rows = await listLlmConnections(workspaceId);
  const i = rows.findIndex((r) => r.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  for (const [p, r] of rows.entries()) await db().update(connections).set({ priority: p }).where(eq(connections.id, r.id));
}

// The Mac editor can use a connected Claude key when the creator has no Claude login there.
export async function anthropicKeyForEditor(workspaceId: number) {
  const row = (await listLlmConnections(workspaceId)).find((r) => r.provider === "anthropic");
  return row ? decryptSecret(row.secret) : undefined;
}
