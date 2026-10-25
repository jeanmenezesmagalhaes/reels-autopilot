import { NextResponse } from "next/server";
import { hasBearer } from "@/lib/auth";
import { anthropicKeyForEditor } from "@/lib/llm";

export const dynamic = "force-dynamic";

// The creator's Mac editor asks for the Claude key connected in Ajustes, used only
// when there is no Claude login on that Mac. Protected by PIPELINE_SECRET, never cached.
export async function GET(req: Request) {
  if (!hasBearer(req, process.env.PIPELINE_SECRET)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const key = await anthropicKeyForEditor();
  return NextResponse.json({ anthropic: key ?? null }, { headers: { "cache-control": "no-store" } });
}
