import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { pipelineWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const body = z.object({
  ideas: z
    .array(z.object({ title: z.string().min(1).max(140), notes: z.string().max(600).optional() }))
    .min(1)
    .max(5),
});

// The analysis routine suggests what to record next; they land in "Planejado".
export async function POST(req: Request) {
  const workspaceId = await pipelineWorkspace(req);
  if (!workspaceId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  const rows = await db()
    .insert(schema.ideas)
    .values(parsed.data.ideas.map((i) => ({ ...i, workspaceId, source: "analise" })))
    .returning({ id: schema.ideas.id });
  return NextResponse.json({ ids: rows.map((r) => r.id) });
}
