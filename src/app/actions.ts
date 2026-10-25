"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, getSetting, schema, setSetting } from "@/db";
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
  const { log } = await tick({ force: true, deadlineMs: 50_000 });
  revalidatePath("/");
  return log;
}
