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

async function call<T>(token: string, path: string, init: { method?: "GET" | "POST"; params?: Record<string, string> } = {}) {
  const method = init.method ?? "GET";
  const url = new URL(path.startsWith("http") ? path : `${BASE}${path}`);
  // Token goes in the query (GET) or form body (POST), as in Meta's docs.
  const params = { ...init.params, access_token: token };
  let body: URLSearchParams | undefined;
  if (method === "GET") {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  } else {
    body = new URLSearchParams(params);
  }
  const res = await fetch(url, { method, body, cache: "no-store" });
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

// Long-lived tokens last 60 days; refreshing resets the clock (token must be >24h old).
export function refreshLongLivedToken(token: string) {
  return call<{ access_token: string; expires_in: number }>(token, "https://graph.instagram.com/refresh_access_token", {
    params: { grant_type: "ig_refresh_token" },
  });
}
