import { del } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { hasBearer } from "@/lib/auth";
import { isOwnBlobUrl } from "@/lib/blob-host";

export const dynamic = "force-dynamic";

const body = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(1),
  blobUrl: z.url().refine(isOwnBlobUrl),
  caption: z.string().max(2200),
  durationS: z.number().positive().optional(),
});

// The Mac editor finished a redo: swap in the new file and caption, back to the queue.
export async function POST(req: Request) {
  if (!hasBearer(req, process.env.PIPELINE_SECRET)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  const { slug, label, blobUrl, caption, durationS } = parsed.data;
  const [row] = await db()
    .select({ id: schema.variants.id, oldUrl: schema.variants.blobUrl })
    .from(schema.variants)
    .innerJoin(schema.videos, eq(schema.variants.videoId, schema.videos.id))
    .where(and(eq(schema.videos.slug, slug), eq(schema.variants.label, label), eq(schema.variants.status, "revision")));
  if (!row) return NextResponse.json({ error: "no pending revision" }, { status: 404 });
  await db()
    .update(schema.variants)
    .set({ blobUrl, caption, durationS, status: "queued", revisionNote: null, attempts: 0, error: null, containerId: null })
    .where(eq(schema.variants.id, row.id));
  if (row.oldUrl !== blobUrl && isOwnBlobUrl(row.oldUrl)) await del(row.oldUrl).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
