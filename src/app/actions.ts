"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { db, getSetting, schema, setSetting } from "@/db";
import { makePrincipalInstagram, removeInstagram } from "@/lib/instagram-account";
import { moveLlm, removeLlm, saveLlmKey, validateKey } from "@/lib/llm";
import { tick } from "@/lib/scheduler";

export async function togglePause() {
  const paused = (await getSetting("paused")) === "true";
  await setSetting("paused", String(!paused));
  revalidatePath("/");
}

// Server Action arguments come from the client; validate them like any request body.
const variantStatusInput = z.object({ id: z.number().int().positive(), status: z.enum(["queued", "skipped"]) });

export async function setVariantStatus(rawId: number, rawStatus: "queued" | "skipped") {
  const { id, status } = variantStatusInput.parse({ id: rawId, status: rawStatus });
  await db()
    .update(schema.variants)
    .set({ status, error: null, ...(status === "queued" ? { attempts: 0, containerId: null } : {}) })
    // Never touch published or in-flight posts.
    .where(and(eq(schema.variants.id, id), inArray(schema.variants.status, ["queued", "failed"])));
  revalidatePath("/");
}

export async function postNextNow() {
  const { log } = await tick({ force: true, deadlineMs: 40_000 });
  console.log("post now:", log.join(" | "));
  revalidatePath("/");
}

const ideaTitle = z.string().trim().min(2).max(140);

export async function addIdea(form: FormData) {
  const title = ideaTitle.safeParse(form.get("title"));
  if (!title.success) return;
  await db().insert(schema.ideas).values({ title: title.data, source: "jean" });
  revalidatePath("/");
}

const ideaStatusInput = z.object({ id: z.number().int().positive(), status: z.enum(["recorded", "dropped"]) });

export async function setIdeaStatus(rawId: number, rawStatus: "recorded" | "dropped") {
  const { id, status } = ideaStatusInput.parse({ id: rawId, status: rawStatus });
  await db()
    .update(schema.ideas)
    .set({ status })
    .where(and(eq(schema.ideas.id, id), eq(schema.ideas.status, "planned")));
  revalidatePath("/");
}

const preference = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("lang"), value: z.enum(["pt", "en", "es"]) }),
  z.object({ kind: z.literal("theme"), value: z.enum(["system", "light", "dark"]) }),
]);

// Language and theme live in cookies; no account settings table needed.
export async function setPreference(kind: "lang" | "theme", value: string) {
  const pref = preference.parse({ kind, value });
  (await cookies()).set(pref.kind, pref.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  revalidatePath("/");
}

const idInput = z.number().int().positive();

export async function disconnectInstagram(id: number) {
  await removeInstagram(idInput.parse(id));
  revalidatePath("/", "layout");
}

export async function setPrincipalInstagram(id: number) {
  await makePrincipalInstagram(idInput.parse(id));
  revalidatePath("/", "layout");
}

// --- Ajustes: AI connections -------------------------------------------------

export type KeyState = { result?: "ok" | "bad" } | null;

const keyInput = z.object({
  provider: z.enum(["anthropic", "openai", "google"]),
  key: z.string().trim().min(20).max(400),
});

// Tests the key with the provider before saving it (encrypted).
export async function addLlmKey(_prev: KeyState, form: FormData): Promise<KeyState> {
  const parsed = keyInput.safeParse({ provider: form.get("provider"), key: form.get("key") });
  if (!parsed.success) return { result: "bad" };
  try {
    await validateKey(parsed.data.provider, parsed.data.key);
  } catch {
    return { result: "bad" };
  }
  await saveLlmKey(parsed.data.provider, parsed.data.key);
  revalidatePath("/", "layout");
  return { result: "ok" };
}

export async function removeLlmConnection(id: number) {
  await removeLlm(idInput.parse(id));
  revalidatePath("/", "layout");
}

export async function moveLlmConnection(id: number, direction: "up" | "down") {
  await moveLlm(idInput.parse(id), z.enum(["up", "down"]).parse(direction));
  revalidatePath("/", "layout");
}

// --- First-run guidance -------------------------------------------------------

export async function dismissDemo() {
  await setSetting("demo_dismissed", "true");
  revalidatePath("/", "layout");
}

export async function hideOnboarding() {
  await setSetting("onboarding_hidden", "true");
  revalidatePath("/", "layout");
}
