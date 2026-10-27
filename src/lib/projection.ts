import type { Variant, Video } from "@/db/schema";

// Only post between 08:00 and 22:59 Brasília time.
export const POST_HOURS = { from: 8, to: 22, timeZone: "America/Sao_Paulo" };
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function hourInPostingZone(date: Date) {
  return Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: POST_HOURS.timeZone }).format(date),
  );
}

// Walks forward hour by hour (the tick runs hourly at :23) and hands out the slots
// the pacing allows: posting hours, at most `postsPerDay` in any 24h, spread out.
// `published` are past post times; each slot handed out counts for the next ones.
export function projectSlots(count: number, published: number[], postsPerDay: number, from = Date.now()) {
  const minGapMs = (DAY / postsPerDay) * 0.8;
  const times = published.filter((x) => from - x < DAY).sort((a, b) => a - b);
  const slots: Date[] = [];
  const t = new Date(from);
  t.setUTCMinutes(23, 0, 0);
  if (t.getTime() < from) t.setTime(t.getTime() + HOUR);
  for (let i = 0; slots.length < count && i < 24 * 120; i++, t.setTime(t.getTime() + HOUR)) {
    const now = t.getTime();
    const hour = hourInPostingZone(t);
    if (hour < POST_HOURS.from || hour > POST_HOURS.to) continue;
    if (times.filter((x) => now - x < DAY).length >= postsPerDay) continue;
    const last = times.at(-1);
    if (last !== undefined && now - last < minGapMs) continue;
    times.push(now);
    slots.push(new Date(now));
  }
  return slots;
}

// When each queued version should go out: the scheduler's slots, filled in the
// scheduler's round-robin order (the video that went longest without a post first).
export function projectQueue(variants: Variant[], postsPerDay: number, from = Date.now()) {
  const published = variants.filter((v) => v.publishedAt).map((v) => v.publishedAt!.getTime());
  if (variants.some((v) => v.status === "processing")) published.push(from);
  const queued = variants.filter((v) => v.status === "queued").sort((a, b) => a.id - b.id);
  const slots = projectSlots(queued.length, published, postsPerDay, from);

  const lastAt = new Map<number, number>();
  for (const v of variants) {
    if (v.publishedAt) lastAt.set(v.videoId, Math.max(lastAt.get(v.videoId) ?? 0, v.publishedAt.getTime()));
  }
  const out = new Map<number, Date>();
  for (const slot of slots) {
    const next = queued
      .filter((v) => !out.has(v.id))
      .sort((a, b) => (lastAt.get(a.videoId) ?? 0) - (lastAt.get(b.videoId) ?? 0) || a.id - b.id)[0];
    out.set(next.id, slot);
    lastAt.set(next.videoId, slot.getTime());
  }
  return out;
}

export type Entry = { variant: Variant; video: Video; at?: Date; projected: boolean };

// One row per version with the date it went (or should go) out. Queued versions only
// get a date while posting can actually happen (not paused, Instagram connected).
export function timeline(videos: Video[], variants: Variant[], o: { postsPerDay: number; canPost: boolean }): Entry[] {
  const byId = new Map(videos.map((v) => [v.id, v]));
  const projected = o.canPost ? projectQueue(variants, o.postsPerDay) : new Map<number, Date>();
  return variants.flatMap((variant) => {
    const video = byId.get(variant.videoId);
    if (!video) return [];
    if (variant.publishedAt) return [{ variant, video, at: variant.publishedAt, projected: false }];
    if (variant.status === "processing") return [{ variant, video, at: new Date(), projected: false }];
    const at = projected.get(variant.id);
    return [{ variant, video, at, projected: Boolean(at) }];
  });
}
