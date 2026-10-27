import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { pipelineWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// What the Mac editor should pick up: videos uploaded from the dashboard (with the
// creator's brief) and versions the creator asked to redo.
export async function GET(req: Request) {
  const workspaceId = await pipelineWorkspace(req);
  if (!workspaceId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const uploads = await db()
    .select({
      slug: schema.videos.slug,
      title: schema.videos.title,
      brief: schema.videos.brief,
      baseCaption: schema.videos.baseCaption,
      rawUrl: schema.videos.rawUrl,
    })
    .from(schema.videos)
    .where(and(eq(schema.videos.workspaceId, workspaceId), eq(schema.videos.stage, "uploaded")));
  const revisions = await db()
    .select({
      slug: schema.videos.slug,
      title: schema.videos.title,
      label: schema.variants.label,
      caption: schema.variants.caption,
      note: schema.variants.revisionNote,
    })
    .from(schema.variants)
    .innerJoin(schema.videos, eq(schema.variants.videoId, schema.videos.id))
    .where(and(eq(schema.variants.workspaceId, workspaceId), eq(schema.variants.status, "revision")));
  return NextResponse.json({ uploads, revisions }, { headers: { "cache-control": "no-store" } });
}
