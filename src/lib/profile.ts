// Perfil: the connected Instagram profile and how it grew over a period. Follower
// growth prefers our own daily snapshots (exact) and falls back to Instagram's
// follows/unfollows counts until a snapshot old enough exists.
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Connection } from "@/db/schema";
import { dayKey } from "./format";
import { listInstagramAccounts } from "./instagram-account";
import { getAccountInsights, getProfile, listMedia, type AccountInsights, type IgMedia, type IgProfile } from "./instagram";
import { decryptSecret } from "./secrets";

const DAY = 86_400_000;
// Meta keeps account insights for 2 years; "tudo" asks for all of it.
const MAX_DAYS = 729;
const MAX_MEDIA = 200;

const { profileSnapshots, variants } = schema;

async function saveSnapshot(igUserId: string, p: IgProfile) {
  const values = { followers: p.followers_count, follows: p.follows_count, media: p.media_count };
  await db()
    .insert(profileSnapshots)
    .values({ igUserId, day: dayKey(new Date()), ...values })
    .onConflictDoUpdate({ target: [profileSnapshots.igUserId, profileSnapshots.day], set: values });
}

// Cron: one snapshot per connected account per day.
export async function snapshotProfiles(workspaceId: number, log: string[]) {
  for (const a of await listInstagramAccounts(workspaceId)) {
    try {
      await saveSnapshot(a.externalId, await getProfile(decryptSecret(a.secret)));
    } catch (err) {
      log.push(`profile snapshot ${a.label}: ${(err as Error).message}`);
    }
  }
}

export type ProfileView = {
  account: Connection;
  profile?: IgProfile;
  error?: string;
  insights?: AccountInsights;
  // Net follower change in the period, and where it came from.
  growth?: { net: number; since?: string };
  posts: { total: number; reels?: number; feed?: number; trialReels?: number };
  recent: IgMedia[];
};

export async function loadProfile(account: Connection, isPrincipal: boolean, days: number | "all"): Promise<ProfileView> {
  const now = new Date();
  const since = new Date(now.getTime() - (days === "all" ? MAX_DAYS : days) * DAY);
  const token = decryptSecret(account.secret);
  const igUserId = account.externalId;

  const [profile, insights, media, base, trialReels] = await Promise.allSettled([
    getProfile(token),
    getAccountInsights(token, igUserId, since, now),
    listMedia(token, days === "all" ? new Date(0) : since, MAX_MEDIA),
    db()
      .select()
      .from(profileSnapshots)
      .where(and(eq(profileSnapshots.igUserId, igUserId), lte(profileSnapshots.day, dayKey(since))))
      .orderBy(desc(profileSnapshots.day))
      .limit(1),
    // Trial Reels don't show on the profile grid; the queue only posts to the principal account.
    isPrincipal
      ? db()
          .select({ id: variants.id })
          .from(variants)
          .where(
            and(eq(variants.workspaceId, account.workspaceId), eq(variants.status, "published"), gte(variants.publishedAt, since)),
          )
      : Promise.resolve([]),
  ]);

  const p = profile.status === "fulfilled" ? profile.value : undefined;
  if (p) await saveSnapshot(igUserId, p).catch(() => {});
  const i = insights.status === "fulfilled" ? insights.value : undefined;
  const list = media.status === "fulfilled" ? media.value : [];
  const inPeriod = days === "all" ? list : list.filter((m) => new Date(m.timestamp) >= since);
  // Past MAX_MEDIA only the profile's own count is complete (no Reels/grid split then).
  const capped = list.length >= MAX_MEDIA;
  const reels = inPeriod.filter((m) => m.media_product_type === "REELS").length;
  const snapshot = base.status === "fulfilled" ? base.value[0] : undefined;

  let growth: ProfileView["growth"];
  if (p && snapshot) growth = { net: p.followers_count - snapshot.followers, since: snapshot.day };
  else if (i?.follows != null && i.unfollows != null) growth = { net: i.follows - i.unfollows };

  const failed = [profile, insights, media].find((r) => r.status === "rejected");
  return {
    account,
    profile: p,
    error: failed ? String((failed as PromiseRejectedResult).reason?.message ?? failed) : undefined,
    insights: i,
    growth,
    posts: {
      total: capped && p ? Math.max(p.media_count, inPeriod.length) : inPeriod.length,
      ...(capped ? {} : { reels, feed: inPeriod.length - reels }),
      trialReels: trialReels.status === "fulfilled" && isPrincipal ? trialReels.value.length : undefined,
    },
    recent: list.slice(0, 9),
  };
}
