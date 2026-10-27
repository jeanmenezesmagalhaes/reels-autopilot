import { NextResponse } from "next/server";
import { db, schema } from "@/db";
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
  const started = Date.now();
  try {
    const result = await tick();
    // Daily follower count per account, so Perfil can show growth beyond what the API keeps.
    // Whatever doesn't fit in the function's time limit is taken on the next hourly run.
    for (const { id } of await db().select({ id: schema.workspaces.id }).from(schema.workspaces)) {
      if (Date.now() - started > 265_000) break;
      await snapshotProfiles(id, result.log);
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
