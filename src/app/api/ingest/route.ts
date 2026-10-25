import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { hasBearer } from "@/lib/auth";
import { isOwnBlobUrl } from "@/lib/blob-host";

export const dynamic = "force-dynamic";

// Only accept videos stored in this project's own Blob store.
const blobUrl = z.url().refine(isOwnBlobUrl, "must be a URL from this project's Blob store");

const body = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  sourceFile: z.string().optional(),
  variants: z
    .array(
      z.object({
        label: z.string().min(1),
        blobUrl,
        caption: z.string().max(2200),
        durationS: z.number().positive().optional(),
      }),
    )
    // Empty list = "started editing": the video shows in the board's "Em edição" column.
    .default([]),
});

export async function POST(req: Request) {
  if (!hasBearer(req, process.env.PIPELINE_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  const { slug, title, sourceFile, variants } = parsed.data;

  const [video] = await db()
    .insert(schema.videos)
    .values({ slug, title, sourceFile })
    .onConflictDoUpdate({ target: schema.videos.slug, set: { title } })
    .returning();
  const rows = variants.length
    ? await db()
        .insert(schema.variants)
        .values(variants.map((v) => ({ ...v, videoId: video.id })))
        .onConflictDoNothing()
        .returning({ id: schema.variants.id })
    : [];

  return NextResponse.json({ videoId: video.id, variantIds: rows.map((r) => r.id) });
}
