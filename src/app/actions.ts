"use server";

import { del } from "@vercel/blob";
import { and, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { redirect } from "next/navigation";
import { db, getWorkspaceSetting, schema, setWorkspaceSetting } from "@/db";
import { makePrincipalInstagram, removeInstagram } from "@/lib/instagram-account";
import { isOwnBlobUrl, rawUploadPrefix } from "@/lib/blob-host";
import { moveLlm, removeLlm, saveLlmKey, validateKey } from "@/lib/llm";
import { tick } from "@/lib/scheduler";
import { SESSION_COOKIE } from "@/lib/session";
import { ensureWorkspace, isAdmin, requireWorkspace } from "@/lib/workspace";

// Every action acts on the signed-in person's own workspace only; ids from the client
// that point elsewhere simply match nothing.

export async function togglePause() {
  const { workspaceId } = await requireWorkspace();
  const paused = (await getWorkspaceSetting(workspaceId, "paused")) === "true";
  await setWorkspaceSetting(workspaceId, "paused", String(!paused));
  revalidatePath("/");
}

// Server Action arguments come from the client; validate them like any request body.
const variantStatusInput = z.object({ id: z.number().int().positive(), status: z.enum(["queued", "skipped"]) });

export async function setVariantStatus(rawId: number, rawStatus: "queued" | "skipped") {
  const { id, status } = variantStatusInput.parse({ id: rawId, status: rawStatus });
  const { workspaceId } = await requireWorkspace();
  await db()
    .update(schema.variants)
    .set({ status, error: null, ...(status === "queued" ? { attempts: 0, containerId: null } : {}) })
    // Never touch published or in-flight posts.
    .where(
      and(eq(schema.variants.id, id), eq(schema.variants.workspaceId, workspaceId), inArray(schema.variants.status, ["queued", "failed"])),
    );
  revalidatePath("/");
}

export async function postNextNow() {
  const { workspaceId } = await requireWorkspace();
  const { log } = await tick({ workspaceId, force: true, deadlineMs: 40_000 });
  console.log("post now:", log.join(" | "));
  revalidatePath("/");
}

const ideaTitle = z.string().trim().min(2).max(140);

export async function addIdea(form: FormData) {
  const title = ideaTitle.safeParse(form.get("title"));
  if (!title.success) return;
  const { workspaceId } = await requireWorkspace();
  await db().insert(schema.ideas).values({ workspaceId, title: title.data, source: "jean" });
  revalidatePath("/");
}

const ideaStatusInput = z.object({ id: z.number().int().positive(), status: z.enum(["recorded", "dropped"]) });

export async function setIdeaStatus(rawId: number, rawStatus: "recorded" | "dropped") {
  const { id, status } = ideaStatusInput.parse({ id: rawId, status: rawStatus });
  const { workspaceId } = await requireWorkspace();
  await db()
    .update(schema.ideas)
    .set({ status })
    .where(and(eq(schema.ideas.id, id), eq(schema.ideas.workspaceId, workspaceId), eq(schema.ideas.status, "planned")));
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
  const { workspaceId } = await requireWorkspace();
  await removeInstagram(workspaceId, idInput.parse(id));
  revalidatePath("/", "layout");
}

export async function setPrincipalInstagram(id: number) {
  const { workspaceId } = await requireWorkspace();
  await makePrincipalInstagram(workspaceId, idInput.parse(id));
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
  const { workspaceId } = await requireWorkspace();
  const parsed = keyInput.safeParse({ provider: form.get("provider"), key: form.get("key") });
  if (!parsed.success) return { result: "bad" };
  try {
    await validateKey(parsed.data.provider, parsed.data.key);
  } catch {
    return { result: "bad" };
  }
  await saveLlmKey(workspaceId, parsed.data.provider, parsed.data.key);
  revalidatePath("/", "layout");
  return { result: "ok" };
}

export async function removeLlmConnection(id: number) {
  const { workspaceId } = await requireWorkspace();
  await removeLlm(workspaceId, idInput.parse(id));
  revalidatePath("/", "layout");
}

export async function moveLlmConnection(id: number, direction: "up" | "down") {
  const { workspaceId } = await requireWorkspace();
  await moveLlm(workspaceId, idInput.parse(id), z.enum(["up", "down"]).parse(direction));
  revalidatePath("/", "layout");
}

// --- First-run guidance -------------------------------------------------------

export async function dismissDemo() {
  const { workspaceId } = await requireWorkspace();
  await setWorkspaceSetting(workspaceId, "demo_dismissed", "true");
  revalidatePath("/", "layout");
}

// Leaves the first-run flow (finished or "Fazer depois"); anything skipped stays in
// "Comece por aqui" on the dashboard.
export async function finishOnboarding() {
  const { workspaceId } = await requireWorkspace();
  await setWorkspaceSetting(workspaceId, "onboarding_done", "true");
  redirect("/");
}

export async function hideOnboarding() {
  const { workspaceId } = await requireWorkspace();
  await setWorkspaceSetting(workspaceId, "onboarding_hidden", "true");
  revalidatePath("/", "layout");
}

// --- New video from the dashboard -------------------------------------------

const newVideo = z.object({
  title: z.string().trim().min(2).max(120),
  brief: z.string().trim().max(2000).optional(),
  baseCaption: z.string().trim().max(2200).optional(),
  rawUrl: z.string().refine(isOwnBlobUrl),
  ideaId: z.number().int().positive().optional(),
});

function slugify(text: string) {
  const base = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${new Date().toISOString().slice(0, 10)}-${base || "video"}-${Math.random().toString(36).slice(2, 6)}`;
}

// The raw video is already in Blob; this registers it with the creator's brief.
// The Mac editor downloads it on its next run and follows the instructions.
export async function createVideo(input: z.input<typeof newVideo>) {
  const v = newVideo.parse(input);
  const { workspaceId } = await requireWorkspace();
  // Only a file this person uploaded (the upload route hands out tokens per workspace).
  if (!new URL(v.rawUrl).pathname.startsWith(`/${rawUploadPrefix(workspaceId)}`)) throw new Error("bad upload");
  await db().insert(schema.videos).values({
    workspaceId,
    slug: slugify(v.title),
    title: v.title,
    brief: v.brief || null,
    baseCaption: v.baseCaption || null,
    rawUrl: v.rawUrl,
    stage: "uploaded",
  });
  if (v.ideaId) {
    await db()
      .update(schema.ideas)
      .set({ status: "recorded" })
      .where(and(eq(schema.ideas.id, v.ideaId), eq(schema.ideas.workspaceId, workspaceId)));
  }
  revalidatePath("/", "layout");
}

// --- Per-version actions (content page) ---------------------------------------

const EDITABLE = ["queued", "failed", "revision"] as const;

// Versions of the signed-in person's workspace, by id, in one of the given states.
async function ownVersion(id: number, states: readonly (typeof EDITABLE)[number][]) {
  const { workspaceId } = await requireWorkspace();
  return and(
    eq(schema.variants.id, idInput.parse(id)),
    eq(schema.variants.workspaceId, workspaceId),
    inArray(schema.variants.status, [...states]),
  );
}

export async function updateCaption(id: number, form: FormData) {
  const caption = z.string().trim().max(2200).parse(form.get("caption") ?? "");
  await db()
    .update(schema.variants)
    .set({ caption })
    .where(await ownVersion(id, EDITABLE));
  revalidatePath("/", "layout");
}

// "Refazer com instruções": the Mac editor redoes this version and sends it back.
export async function requestRevision(id: number, form: FormData) {
  const note = z.string().trim().min(3).max(1000).parse(form.get("note") ?? "");
  await db()
    .update(schema.variants)
    .set({ status: "revision", revisionNote: note })
    .where(await ownVersion(id, ["queued", "failed", "revision"]));
  revalidatePath("/", "layout");
}

export async function cancelVersion(id: number) {
  await db()
    .update(schema.variants)
    .set({ status: "skipped", revisionNote: null })
    .where(await ownVersion(id, EDITABLE));
  revalidatePath("/", "layout");
}

export async function cancelPendingVersions(videoId: number) {
  const { workspaceId } = await requireWorkspace();
  await db()
    .update(schema.variants)
    .set({ status: "skipped", revisionNote: null })
    .where(
      and(
        eq(schema.variants.videoId, idInput.parse(videoId)),
        eq(schema.variants.workspaceId, workspaceId),
        inArray(schema.variants.status, [...EDITABLE]),
      ),
    );
  revalidatePath("/", "layout");
}

// --- Account --------------------------------------------------------------------

// Erases the person and everything in their dashboard: ideas, videos, versions,
// connected accounts, and the files still in Blob. Published Reels stay on Instagram.
export async function deleteAccount() {
  const { userId, workspaceId } = await requireWorkspace();
  if (userId === 0) return; // password sign-in has no account to delete
  const { variants, videos, connections, members, profileSnapshots, users, workspaces } = schema;
  const others = await db()
    .select({ userId: members.userId })
    .from(members)
    .where(and(eq(members.workspaceId, workspaceId), ne(members.userId, userId)));
  if (others.length === 0) {
    const files = [
      ...(await db().select({ url: variants.blobUrl }).from(variants).where(eq(variants.workspaceId, workspaceId))),
      ...(await db()
        .select({ url: videos.rawUrl })
        .from(videos)
        .where(and(eq(videos.workspaceId, workspaceId), isNotNull(videos.rawUrl)))),
    ]
      .map((f) => f.url!)
      .filter(isOwnBlobUrl);
    if (files.length) await del(files).catch((err) => console.error("blob cleanup failed:", (err as Error).message));
    const ig = await db()
      .select({ id: connections.externalId })
      .from(connections)
      .where(and(eq(connections.workspaceId, workspaceId), eq(connections.kind, "instagram")));
    if (ig.length) await db().delete(profileSnapshots).where(inArray(profileSnapshots.igUserId, ig.map((a) => a.id)));
    await db().delete(workspaces).where(eq(workspaces.id, workspaceId));
  }
  await db().delete(users).where(eq(users.id, userId));
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login?excluido=1");
}

// --- Admin: early-access list -----------------------------------------------------

export async function grantAccess(id: number) {
  const ws = await requireWorkspace();
  if (!(await isAdmin(ws))) return;
  const [user] = await db()
    .update(schema.users)
    .set({ role: "member" })
    .where(and(eq(schema.users.id, idInput.parse(id)), eq(schema.users.role, "waitlist")))
    .returning();
  if (user) await ensureWorkspace(user);
  revalidatePath("/ajustes");
}
