import { NextResponse } from "next/server";
import { googleConfigured, OAUTH_COOKIE, pkceChallenge, randomToken, redirectUri } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!googleConfigured()) return NextResponse.redirect(new URL("/login", req.url));
  const state = randomToken();
  const verifier = randomToken(48);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(req),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_COOKIE, `${state}.${verifier}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 600,
  });
  return res;
}
