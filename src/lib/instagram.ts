// Instagram API with Instagram Login (graph.instagram.com).
// Docs: https://developers.facebook.com/docs/instagram-platform/content-publishing

const version = process.env.IG_API_VERSION ?? "v23.0";
const BASE = `https://graph.instagram.com/${version}`;

export type GraduationStrategy = "MANUAL" | "SS_PERFORMANCE";
export type ContainerStatus = "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED" | "PUBLISHED";

export class InstagramError extends Error {
  constructor(message: string, readonly status: number, readonly body: unknown) {
    super(message);
  }
}

async function call<T>(
  token: string,
  path: string,
  init: { method?: "GET" | "POST"; params?: Record<string, string>; tokenInQuery?: boolean } = {},
) {
  const method = init.method ?? "GET";
  const url = new URL(path.startsWith("http") ? path : `${BASE}${path}`);
  // Token travels in a header, so it stays out of URLs; refresh is the one documented exception.
  const headers: Record<string, string> = init.tokenInQuery ? {} : { Authorization: `Bearer ${token}` };
  if (init.tokenInQuery) url.searchParams.set("access_token", token);
  let body: URLSearchParams | undefined;
  if (method === "GET") {
    for (const [k, v] of Object.entries(init.params ?? {})) url.searchParams.set(k, v);
  } else {
    body = new URLSearchParams(init.params);
  }
  const res = await fetch(url, { method, headers, body, cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const msg = json.error?.error_user_msg ?? json.error?.message ?? `HTTP ${res.status}`;
    throw new InstagramError(msg, res.status, json);
  }
  return json as T;
}

export function createTrialReelContainer(opts: {
  token: string;
  userId: string;
  videoUrl: string;
  caption: string;
  graduation: GraduationStrategy;
}) {
  return call<{ id: string }>(opts.token, `/${opts.userId}/media`, {
    method: "POST",
    params: {
      media_type: "REELS",
      video_url: opts.videoUrl,
      caption: opts.caption,
      trial_params: JSON.stringify({ graduation_strategy: opts.graduation }),
    },
  });
}

export function getContainerStatus(token: string, containerId: string) {
  return call<{ status_code: ContainerStatus; status?: string }>(token, `/${containerId}`, {
    params: { fields: "status_code,status" },
  });
}

export function publishContainer(token: string, userId: string, containerId: string) {
  return call<{ id: string }>(token, `/${userId}/media_publish`, {
    method: "POST",
    params: { creation_id: containerId },
  });
}

export function getPermalink(token: string, mediaId: string) {
  return call<{ permalink?: string }>(token, `/${mediaId}`, { params: { fields: "permalink" } });
}

const INSIGHT_METRICS = ["views", "reach", "likes", "comments", "shares", "saved", "ig_reels_avg_watch_time"] as const;
export type Insights = Partial<Record<(typeof INSIGHT_METRICS)[number], number>>;

export async function getReelInsights(token: string, mediaId: string): Promise<Insights> {
  const res = await call<{ data: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }>(
    token,
    `/${mediaId}/insights`,
    { params: { metric: INSIGHT_METRICS.join(",") } },
  );
  return Object.fromEntries(res.data.map((m) => [m.name, m.total_value?.value ?? m.values?.[0]?.value ?? 0]));
}

export type IgProfile = {
  username: string;
  name?: string;
  biography?: string;
  website?: string;
  profile_picture_url?: string;
  followers_count: number;
  follows_count: number;
  media_count: number;
};

export function getProfile(token: string) {
  return call<IgProfile>(token, "/me", {
    params: { fields: "username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count" },
  });
}

const ACCOUNT_METRICS = ["views", "reach", "accounts_engaged", "likes", "comments", "shares", "saves"] as const;
export type AccountInsights = Partial<Record<(typeof ACCOUNT_METRICS)[number], number>> & { follows?: number; unfollows?: number };

type TotalValue = { value?: number; breakdowns?: { results?: { dimension_values: string[]; value: number }[] }[] };

// Account totals over a window (Meta keeps 2 years). Breakdowns can't be mixed with
// plain totals, so `follows_and_unfollows` is its own request, split by follow_type:
// FOLLOWER = accounts that followed, NON_FOLLOWER = accounts that left.
export async function getAccountInsights(token: string, userId: string, since: Date, until: Date): Promise<AccountInsights> {
  const window = {
    period: "day",
    metric_type: "total_value",
    since: String(Math.floor(since.getTime() / 1000)),
    until: String(Math.floor(until.getTime() / 1000)),
  };
  type Res = { data: { name: string; total_value?: TotalValue }[] };
  const [totals, follows] = await Promise.all([
    call<Res>(token, `/${userId}/insights`, { params: { ...window, metric: ACCOUNT_METRICS.join(",") } }),
    call<Res>(token, `/${userId}/insights`, { params: { ...window, metric: "follows_and_unfollows", breakdown: "follow_type" } }),
  ]);
  const out: AccountInsights = Object.fromEntries(totals.data.map((m) => [m.name, m.total_value?.value ?? 0]));
  const rows = follows.data[0]?.total_value?.breakdowns?.[0]?.results ?? [];
  const of = (k: string) => rows.find((r) => r.dimension_values[0] === k)?.value ?? 0;
  return { ...out, follows: of("FOLLOWER"), unfollows: of("NON_FOLLOWER") };
}

export type IgMedia = {
  id: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_product_type?: "FEED" | "REELS" | "STORY" | "AD";
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
};

// Newest first, paging until a post older than `since` shows up (or `max` is reached).
export async function listMedia(token: string, since: Date, max: number) {
  const out: IgMedia[] = [];
  let next: string | undefined = "/me/media";
  while (next && out.length < max) {
    const page: { data: IgMedia[]; paging?: { next?: string } } = await call(token, next, {
      params: next.startsWith("http")
        ? {}
        : { fields: "id,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count", limit: "50" },
    });
    out.push(...page.data);
    const last = page.data.at(-1);
    next = last && new Date(last.timestamp) >= since ? page.paging?.next : undefined;
  }
  return out;
}

// Long-lived tokens last 60 days; refreshing resets the clock (token must be >24h old).
export function refreshLongLivedToken(token: string) {
  return call<{ access_token: string; expires_in: number }>(token, "https://graph.instagram.com/refresh_access_token", {
    params: { grant_type: "ig_refresh_token" },
    // Meta documents this endpoint with the token as a query parameter only.
    tokenInQuery: true,
  });
}

// "Conectar Instagram" (Instagram API with Instagram Login): code → short-lived → long-lived token.
export const IG_SCOPES = ["instagram_business_basic", "instagram_business_content_publish", "instagram_business_manage_insights"];

export function igAuthorizeUrl(redirectUri: string, state: string) {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.search = new URLSearchParams({
    client_id: process.env.IG_APP_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: IG_SCOPES.join(","),
    state,
  }).toString();
  return url;
}

export async function igExchangeCode(code: string, redirectUri: string) {
  const res = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.IG_APP_ID!,
      client_secret: process.env.IG_APP_SECRET!,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new InstagramError("code exchange failed", res.status, json.error_type ?? "");
  const short = json.access_token as string;
  const long = await call<{ access_token: string }>(short, "https://graph.instagram.com/access_token", {
    params: { grant_type: "ig_exchange_token", client_secret: process.env.IG_APP_SECRET! },
    tokenInQuery: true,
  });
  const me = await call<{ user_id?: string; id?: string; username?: string }>(long.access_token, "/me", {
    params: { fields: "user_id,username" },
  });
  return { token: long.access_token, userId: String(me.user_id ?? json.user_id), username: me.username };
}
