import { del } from "@vercel/blob";
import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db, getSetting, schema, setSetting } from "@/db";
import type { Variant } from "@/db/schema";
import {
  createTrialReelContainer,
  getContainerStatus,
  getPermalink,
  getReelInsights,
  publishContainer,
  refreshLongLivedToken,
  type GraduationStrategy,
} from "./instagram";

const { variants } = schema;

const MAX_ATTEMPTS = 3;
const TOKEN_REFRESH_EVERY_MS = 7 * 24 * 60 * 60 * 1000;
const POLL_INTERVAL_MS = 10_000;
// Only post between 08:00 and 22:59 Brasília time.
const POST_HOURS = { from: 8, to: 22, timeZone: "America/Sao_Paulo" };
const METRICS_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const METRICS_STALE_MS = 6 * 60 * 60 * 1000;

export type TickResult = { log: string[] };

function config() {
  const userId = process.env.IG_USER_ID;
  if (!userId) throw new Error("IG_USER_ID is not set");
  const postsPerDay = Math.max(1, Number(process.env.POSTS_PER_DAY ?? 2));
  const graduation = (process.env.IG_GRADUATION_STRATEGY ?? "MANUAL") as GraduationStrategy;
  return { userId, postsPerDay, graduation };
}

async function getToken(log: string[]) {
  const stored = await getSetting("ig_access_token");
  const token = stored ?? process.env.IG_ACCESS_TOKEN;
  if (!token) throw new Error("No Instagram token: set IG_ACCESS_TOKEN");

  const refreshedAt = Number((await getSetting("ig_token_refreshed_at")) ?? 0);
  if (Date.now() - refreshedAt < TOKEN_REFRESH_EVERY_MS) return token;
  try {
    const fresh = await refreshLongLivedToken(token);
    await setSetting("ig_access_token", fresh.access_token);
    await setSetting("ig_token_refreshed_at", String(Date.now()));
    log.push("token refreshed");
    return fresh.access_token;
  } catch (err) {
    // A brand-new token can't be refreshed for 24h; keep using it.
    log.push(`token refresh skipped: ${(err as Error).message}`);
    return token;
  }
}

async function publishFinished(token: string, userId: string, v: Variant, log: string[]) {
  const { status_code, status } = await getContainerStatus(token, v.containerId!);
  if (status_code === "IN_PROGRESS") return false;
  if (status_code !== "FINISHED") {
    await db()
      .update(variants)
      .set({ status: "failed", error: `container ${status_code}: ${status ?? ""}` })
      .where(eq(variants.id, v.id));
    log.push(`variant ${v.id} failed: ${status_code}`);
    return true;
  }
  const { id: mediaId } = await publishContainer(token, userId, v.containerId!);
  const { permalink } = await getPermalink(token, mediaId).catch(() => ({ permalink: undefined }));
  await db()
    .update(variants)
    .set({ status: "published", mediaId, permalink, publishedAt: new Date(), error: null })
    .where(eq(variants.id, v.id));
  log.push(`variant ${v.id} published ${permalink ?? mediaId}`);
  // The video is live on Instagram now; don't keep a public copy around.
  await del(v.blobUrl).catch((err) => log.push(`blob delete failed: ${(err as Error).message}`));
  return true;
}

async function refreshMetrics(token: string, log: string[]) {
  const now = Date.now();
  const due = await db()
    .select()
    .from(variants)
    .where(
      and(
        eq(variants.status, "published"),
        isNotNull(variants.mediaId),
        gte(variants.publishedAt, new Date(now - METRICS_WINDOW_MS)),
        or(isNull(variants.metricsAt), lt(variants.metricsAt, new Date(now - METRICS_STALE_MS))),
      ),
    )
    .limit(15);
  for (const v of due) {
    try {
      const m = await getReelInsights(token, v.mediaId!);
      await db()
        .update(variants)
        .set({
          views: m.views,
          reach: m.reach,
          likes: m.likes,
          comments: m.comments,
          shares: m.shares,
          saves: m.saved,
          avgWatchMs: m.ig_reels_avg_watch_time,
          metricsAt: new Date(),
        })
        .where(eq(variants.id, v.id));
    } catch (err) {
      log.push(`metrics ${v.id}: ${(err as Error).message}`);
    }
  }
  if (due.length) log.push(`metrics refreshed for ${due.length}`);
}

function insidePostingHours() {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: POST_HOURS.timeZone }).format(
      new Date(),
    ),
  );
  return hour >= POST_HOURS.from && hour <= POST_HOURS.to;
}

// Round-robin: next variant comes from the video that went longest without a post.
async function pickNext() {
  const queued = await db()
    .select()
    .from(variants)
    .where(eq(variants.status, "queued"))
    .orderBy(asc(variants.id));
  if (queued.length === 0) return undefined;

  const videoIds = [...new Set(queued.map((v) => v.videoId))];
  const last = await db()
    .select({ videoId: variants.videoId, at: sql<string>`max(${variants.publishedAt})` })
    .from(variants)
    .where(and(inArray(variants.videoId, videoIds), isNotNull(variants.publishedAt)))
    .groupBy(variants.videoId);
  const lastAt = new Map(last.map((r) => [r.videoId, new Date(r.at).getTime()]));

  return queued.sort((a, b) => (lastAt.get(a.videoId) ?? 0) - (lastAt.get(b.videoId) ?? 0) || a.id - b.id)[0];
}

async function slotIsFree(postsPerDay: number) {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ count }] = await db()
    .select({ count: sql<number>`count(*)::int` })
    .from(variants)
    .where(and(eq(variants.status, "published"), gte(variants.publishedAt, dayAgo)));
  if (count >= postsPerDay) return false;

  // Keep posts spread out; 0.8 tolerates cron jitter.
  const minGapMs = ((24 * 60 * 60 * 1000) / postsPerDay) * 0.8;
  const [latest] = await db()
    .select({ at: variants.publishedAt })
    .from(variants)
    .where(isNotNull(variants.publishedAt))
    .orderBy(sql`${variants.publishedAt} desc`)
    .limit(1);
  return !latest?.at || Date.now() - latest.at.getTime() >= minGapMs;
}

export async function tick({ force = false, deadlineMs = 240_000 } = {}): Promise<TickResult> {
  const log: string[] = [];
  const deadline = Date.now() + deadlineMs;

  if ((await getSetting("paused")) === "true") {
    log.push("paused");
    return { log };
  }

  const { userId, postsPerDay, graduation } = config();
  const token = await getToken(log);
  await refreshMetrics(token, log);

  // 1. Finish containers left from a previous tick.
  const processing = await db().select().from(variants).where(eq(variants.status, "processing"));
  for (const v of processing) await publishFinished(token, userId, v, log);
  if (processing.length > 0 && !force) return { log };

  // 2. Start the next one if the pacing allows it.
  if (!force && !insidePostingHours()) {
    log.push("outside posting hours");
    return { log };
  }
  if (!force && !(await slotIsFree(postsPerDay))) {
    log.push("no free slot");
    return { log };
  }
  const next = await pickNext();
  if (!next) {
    log.push("queue empty");
    return { log };
  }

  try {
    const { id: containerId } = await createTrialReelContainer({
      token,
      userId,
      videoUrl: next.blobUrl,
      caption: next.caption,
      graduation,
    });
    await db()
      .update(variants)
      .set({ status: "processing", containerId, attempts: next.attempts + 1, error: null })
      .where(eq(variants.id, next.id));
    log.push(`variant ${next.id} container ${containerId}`);

    // 3. Wait for Instagram to process the video inside this invocation when possible.
    const current = { ...next, containerId };
    while (Date.now() + POLL_INTERVAL_MS < deadline) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      if (await publishFinished(token, userId, current, log)) break;
    }
  } catch (err) {
    const attempts = next.attempts + 1;
    await db()
      .update(variants)
      .set({ status: attempts >= MAX_ATTEMPTS ? "failed" : "queued", attempts, error: (err as Error).message })
      .where(eq(variants.id, next.id));
    log.push(`variant ${next.id} error: ${(err as Error).message}`);
  }

  return { log };
}
