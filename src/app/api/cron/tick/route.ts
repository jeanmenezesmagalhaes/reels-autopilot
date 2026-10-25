import { NextResponse } from "next/server";
import { hasBearer } from "@/lib/auth";
import { snapshotProfiles } from "@/lib/profile";
import { tick } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: Request) {
  if (!hasBearer(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await tick();
    // Daily follower count per account, so Perfil can show growth beyond what the API keeps.
    await snapshotProfiles(result.log);
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
