import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, getSetting, schema, setSetting } from "@/db";
import { hasBearer } from "@/lib/auth";
import { hasLlm } from "@/lib/llm";

export const dynamic = "force-dynamic";

const { variants, videos } = schema;

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

// Performance data for the local analysis routine (pipeline/ANALYZE_PROMPT.md).
export async function GET(req: Request) {
  if (!hasBearer(req, process.env.PIPELINE_SECRET)) return unauthorized();
  const rows = await db()
    .select({
      video: videos.title,
      slug: videos.slug,
      label: variants.label,
      caption: variants.caption,
      durationS: variants.durationS,
      publishedAt: variants.publishedAt,
      views: variants.views,
      reach: variants.reach,
      likes: variants.likes,
      comments: variants.comments,
      shares: variants.shares,
      saves: variants.saves,
      avgWatchMs: variants.avgWatchMs,
      metricsAt: variants.metricsAt,
    })
    .from(variants)
    .innerJoin(videos, eq(variants.videoId, videos.id))
    .where(eq(variants.status, "published"))
    .orderBy(desc(variants.publishedAt));
  const ideas = await db()
    .select({ title: schema.ideas.title, status: schema.ideas.status })
    .from(schema.ideas)
    .orderBy(desc(schema.ideas.createdAt))
    .limit(50);
  // serverAnalysis: an AI is connected in Ajustes, so the server writes the analysis.
  return NextResponse.json({ learnings: (await getSetting("learnings")) ?? "", posts: rows, ideas, serverAnalysis: await hasLlm() });
}

const body = z.union([
  z.object({ learnings: z.string().min(1).max(20_000) }),
  z.object({
    heartbeat: z.object({ provider: z.enum(["claude", "codex", "none"]), task: z.enum(["edit", "analyze", "ping"]), ok: z.boolean() }),
  }),
]);

// The analysis routine saves its conclusions here; the local runner reports each run.
export async function POST(req: Request) {
  if (!hasBearer(req, process.env.PIPELINE_SECRET)) return unauthorized();
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  if ("learnings" in parsed.data) await setSetting("learnings", parsed.data.learnings);
  else await setSetting("runner", JSON.stringify({ ...parsed.data.heartbeat, at: Date.now() }));
  return NextResponse.json({ ok: true });
}
