import { del } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { pipelineWorkspace } from "@/lib/workspace";
import { isOwnBlobUrl } from "@/lib/blob-host";

export const dynamic = "force-dynamic";

// The Mac editor downloaded an uploaded video: move it to "editing" and delete the raw copy.
export async function POST(req: Request) {
  const workspaceId = await pipelineWorkspace(req);
  if (!workspaceId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = z.object({ slug: z.string().regex(/^[a-z0-9-]+$/) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const [video] = await db()
    .select()
    .from(schema.videos)
    .where(
      and(eq(schema.videos.workspaceId, workspaceId), eq(schema.videos.slug, parsed.data.slug), eq(schema.videos.stage, "uploaded")),
    );
  if (!video) return NextResponse.json({ ok: false });
  await db().update(schema.videos).set({ stage: "editing", rawUrl: null }).where(eq(schema.videos.id, video.id));
  if (video.rawUrl && isOwnBlobUrl(video.rawUrl)) await del(video.rawUrl).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
