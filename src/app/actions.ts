"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, getSetting, schema, setSetting } from "@/db";
import { tick } from "@/lib/scheduler";

export async function togglePause() {
  const paused = (await getSetting("paused")) === "true";
  await setSetting("paused", String(!paused));
  revalidatePath("/");
}

export async function setVariantStatus(id: number, status: "queued" | "skipped") {
  await db()
    .update(schema.variants)
    .set({ status, error: null, ...(status === "queued" ? { attempts: 0, containerId: null } : {}) })
    .where(eq(schema.variants.id, id));
  revalidatePath("/");
}

export async function postNextNow() {
  const { log } = await tick({ force: true, deadlineMs: 50_000 });
  revalidatePath("/");
  return log;
}
