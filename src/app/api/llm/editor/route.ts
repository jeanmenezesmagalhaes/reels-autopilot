import { NextResponse } from "next/server";
import { anthropicKeyForEditor } from "@/lib/llm";
import { pipelineWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// The creator's Mac editor asks for the Claude key connected in Ajustes, used only
// when there is no Claude login on that Mac. Only that workspace's key, never cached.
export async function GET(req: Request) {
  const workspaceId = await pipelineWorkspace(req);
  if (!workspaceId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const key = await anthropicKeyForEditor(workspaceId);
  return NextResponse.json({ anthropic: key ?? null }, { headers: { "cache-control": "no-store" } });
}
