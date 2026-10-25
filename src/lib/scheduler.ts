import { del } from "@vercel/blob";
import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db, getSetting, schema } from "@/db";
import type { Variant } from "@/db/schema";
import { maybeAnalyze } from "./analysis";
import { getIgAccount, markIgStatus, saveIgToken } from "./instagram-account";
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
  const postsPerDay = Math.max(1, Number(process.env.POSTS_PER_DAY ?? 2));
  const graduation = (process.env.IG_GRADUATION_STRATEGY ?? "MANUAL") as GraduationStrategy;
  return { postsPerDay, graduation };
}

// Long-lived tokens last 60 days; refresh weekly. A failure marks the account in
// error so Ajustes shows it long before the token actually expires.
async function getToken(account: { id: number; token: string; refreshedAt: Date }, log: string[]) {
  if (Date.now() - account.refreshedAt.getTime() < TOKEN_REFRESH_EVERY_MS) return account.token;
  try {
    const fresh = await refreshLongLivedToken(account.token);
    await saveIgToken(account.id, fresh.access_token);
    log.push("token refreshed");
    return fresh.access_token;
  } catch (err) {
    log.push(`token refresh failed: ${(err as Error).message}`);
    await markIgStatus(account.id, false, (err as Error).message);
    return account.token;
  }
}

async function markPublished(v: Variant, mediaId: string | null, permalink: string | undefined, log: string[]) {
  await db()
    .update(variants)
    .set({ status: "published", mediaId, permalink, publishedAt: new Date(), error: null })
    .where(eq(variants.id, v.id));
  log.push(`variant ${v.id} published ${permalink ?? mediaId ?? "(found already published)"}`);
  // The video is live on Instagram now; don't keep a public copy around.
  await del(v.blobUrl).catch((err) => log.push(`blob delete failed: ${(err as Error).message}`));
}

// Returns true once the variant left "processing" (published or failed).
async function publishFinished(token: string, userId: string, v: Variant, log: string[]) {
  const { status_code, status } = await getContainerStatus(token, v.containerId!);
  if (status_code === "IN_PROGRESS") return false;
  // A previous run published it but died before saving; never treat that as a failure.
  if (status_code === "PUBLISHED") {
    await markPublished(v, null, undefined, log);
    return true;
  }
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
  await markPublished(v, mediaId, permalink, log);
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

function hourInPostingZone(date: Date) {
  return Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: POST_HOURS.timeZone }).format(date),
  );
}

function insidePostingHours() {
  const hour = hourInPostingZone(new Date());
  return hour >= POST_HOURS.from && hour <= POST_HOURS.to;
}

// Best guess of when the next post goes out, for the dashboard. Walks forward
// hour by hour (the tick runs hourly at :23) until pacing and posting hours allow it.
export async function estimateNextPostAt() {
  const postsPerDay = Math.max(1, Number(process.env.POSTS_PER_DAY ?? 2));
  const dayMs = 24 * 60 * 60 * 1000;
  const minGapMs = (dayMs / postsPerDay) * 0.8;
  const recent = await db()
    .select({ at: variants.publishedAt })
    .from(variants)
    .where(and(eq(variants.status, "published"), gte(variants.publishedAt, new Date(Date.now() - dayMs))))
    .orderBy(asc(variants.publishedAt));
  const times = recent.map((r) => r.at!.getTime());

  const t = new Date();
  t.setUTCMinutes(23, 0, 0);
  if (t.getTime() < Date.now()) t.setTime(t.getTime() + 60 * 60 * 1000);
  for (let i = 0; i < 72; i++, t.setTime(t.getTime() + 60 * 60 * 1000)) {
    const now = t.getTime();
    const hour = hourInPostingZone(t);
    if (hour < POST_HOURS.from || hour > POST_HOURS.to) continue;
    const inWindow = times.filter((x) => now - x < dayMs);
    if (inWindow.length >= postsPerDay) continue;
    const last = times.at(-1);
    if (last !== undefined && now - last < minGapMs) continue;
    return new Date(now);
  }
  return undefined;
}

// Round-robin: next variant comes from the video that went longest without a post.
export async function pickNext() {
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

// Vercel cron, GitHub Actions and the "Post now" button can fire at the same time.
// A lease row in `settings` makes sure only one tick runs; it expires on its own if a
// run dies, so a crash never blocks posting for more than LOCK_MS.
const LOCK_KEY = "tick_lock";
const LOCK_MS = 6 * 60 * 1000;

// Returns the lease value we wrote, so release only frees our own lease.
async function acquireLock() {
  const now = Date.now();
  const until = String(now + LOCK_MS);
  const inserted = await db()
    .insert(schema.settings)
    .values({ key: LOCK_KEY, value: until })
    .onConflictDoNothing()
    .returning({ key: schema.settings.key });
  if (inserted.length) return until;
  const taken = await db()
    .update(schema.settings)
    .set({ value: until, updatedAt: new Date() })
    .where(and(eq(schema.settings.key, LOCK_KEY), sql`${schema.settings.value}::bigint < ${now}`))
    .returning({ key: schema.settings.key });
  return taken.length > 0 ? until : undefined;
}

async function releaseLock(until: string) {
  await db()
    .update(schema.settings)
    .set({ value: "0" })
    .where(and(eq(schema.settings.key, LOCK_KEY), eq(schema.settings.value, until)));
}

export async function tick(opts: { force?: boolean; deadlineMs?: number } = {}): Promise<TickResult> {
  const lease = await acquireLock();
  if (!lease) return { log: ["another tick is running"] };
  try {
    return await runTick(opts);
  } finally {
    await releaseLock(lease);
  }
}

async function runTick({ force = false, deadlineMs = 240_000 } = {}): Promise<TickResult> {
  const log: string[] = [];
  const deadline = Date.now() + deadlineMs;

  if ((await getSetting("paused")) === "true") {
    log.push("paused");
    return { log };
  }

  const { postsPerDay, graduation } = config();
  const account = await getIgAccount();
  if (!account) {
    log.push("instagram not connected");
    return { log };
  }
  const { userId } = account;
  const token = await getToken(account, log);

  try {
    await postNext({ token, userId, postsPerDay, graduation, force, deadline, log });
  } finally {
    // Metrics and analysis last, so they never eat into the publishing time budget.
    if (Date.now() < deadline) await refreshMetrics(token, log);
    if (Date.now() < deadline) await maybeAnalyze(log);
  }
  return { log };
}

async function postNext(o: {
  token: string;
  userId: string;
  postsPerDay: number;
  graduation: GraduationStrategy;
  force: boolean;
  deadline: number;
  log: string[];
}) {
  const { token, userId, force, log } = o;
  const inHours = insidePostingHours();

  // 1. Finish containers left from a previous tick (still only inside posting hours).
  const processing = await db().select().from(variants).where(eq(variants.status, "processing"));
  for (const v of processing) {
    if (!v.containerId) continue; // claimed by a run that died before creating it; see below
    if (!force && !inHours) {
      log.push(`variant ${v.id} waiting for posting hours`);
      continue;
    }
    try {
      await publishFinished(token, userId, v, log);
    } catch (err) {
      const attempts = v.attempts + 1;
      await db()
        .update(variants)
        .set({
          attempts,
          error: (err as Error).message,
          // Give up after MAX_ATTEMPTS; check Instagram before retrying a failed one.
          ...(attempts >= MAX_ATTEMPTS ? { status: "failed" as const } : {}),
        })
        .where(eq(variants.id, v.id));
      log.push(`variant ${v.id} publish error: ${(err as Error).message}`);
    }
  }
  // We hold the lock, so a claim without a container is from a run that died mid-start;
  // nothing reached Instagram, put it back in the queue.
  await db()
    .update(variants)
    .set({ status: "queued" })
    .where(and(eq(variants.status, "processing"), isNull(variants.containerId)));
  if (processing.length > 0 && !force) return;

  // 2. Start the next one if the pacing allows it.
  if (!force && !inHours) {
    log.push("outside posting hours");
    return;
  }
  if (!force && !(await slotIsFree(o.postsPerDay))) {
    log.push("no free slot");
    return;
  }
  const next = await pickNext();
  if (!next) {
    log.push("queue empty");
    return;
  }

  // Claim it first, so a skip clicked meanwhile (or another run) can't be overwritten.
  const [claimed] = await db()
    .update(variants)
    .set({ status: "processing", attempts: next.attempts + 1, error: null })
    .where(and(eq(variants.id, next.id), eq(variants.status, "queued")))
    .returning();
  if (!claimed) {
    log.push(`variant ${next.id} changed before it could start`);
    return;
  }

  let containerId: string | undefined;
  try {
    ({ id: containerId } = await createTrialReelContainer({
      token,
      userId,
      videoUrl: claimed.blobUrl,
      caption: claimed.caption,
      graduation: o.graduation,
    }));
    await db().update(variants).set({ containerId }).where(eq(variants.id, claimed.id));
    log.push(`variant ${claimed.id} container ${containerId}`);

    // 3. Wait for Instagram to process the video inside this invocation when possible.
    const current = { ...claimed, containerId };
    while (Date.now() + POLL_INTERVAL_MS < o.deadline) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      if (await publishFinished(token, userId, current, log)) break;
    }
  } catch (err) {
    const message = (err as Error).message;
    if (containerId) {
      // The container exists and may even be published; leave it in "processing"
      // so step 1 resolves it from Instagram's own status. Never re-queue it.
      await db().update(variants).set({ containerId, error: message }).where(eq(variants.id, claimed.id));
    } else {
      await db()
        .update(variants)
        .set({ status: claimed.attempts >= MAX_ATTEMPTS ? "failed" : "queued", error: message })
        .where(eq(variants.id, claimed.id));
    }
    log.push(`variant ${claimed.id} error: ${message}`);
  }
}
