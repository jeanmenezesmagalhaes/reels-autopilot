// "Sign in with Google": OAuth 2.0 authorization code flow with PKCE and state.
// Scopes are only openid/email/profile, which need no Google verification.

export const OAUTH_COOKIE = "oauth";

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// AUTH_URL pins the public origin so the redirect URI always matches the one
// registered at Google, whichever Vercel alias the request came through.
export function redirectUri(req: Request) {
  return new URL("/api/auth/callback/google", process.env.AUTH_URL ?? new URL(req.url).origin).toString();
}

function b64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function randomToken(bytes = 32) {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function pkceChallenge(verifier: string) {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
}

export async function exchangeCode(code: string, verifier: string, redirect: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirect,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
  return (await res.json()) as { access_token: string };
}

// The access token came straight from Google over TLS, so its userinfo is trusted.
export async function fetchProfile(accessToken: string) {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`userinfo failed: ${res.status}`);
  return (await res.json()) as { email?: string; email_verified?: boolean; name?: string };
}
