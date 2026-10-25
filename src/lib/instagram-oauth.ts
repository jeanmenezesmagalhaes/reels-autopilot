export const IG_STATE_COOKIE = "ig_oauth";

export function igRedirectUri(req: Request) {
  return new URL("/api/instagram/callback", process.env.AUTH_URL ?? new URL(req.url).origin).toString();
}
