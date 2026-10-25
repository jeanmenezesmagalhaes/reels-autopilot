import { NextResponse } from "next/server";
import { pkceChallenge, randomToken } from "@/lib/google";
import { isOwnerRequest } from "@/lib/owner";

export const dynamic = "force-dynamic";

// "Entrar com OpenRouter": OAuth PKCE; OpenRouter hands back a key tied to the
// creator's own OpenRouter account and credits. Owner only.
export async function GET(req: Request) {
  if (!(await isOwnerRequest(req))) return NextResponse.redirect(new URL("/login", req.url));
  const verifier = randomToken(48);
  const callback = new URL("/api/llm/openrouter/callback", process.env.AUTH_URL ?? new URL(req.url).origin);
  const url = new URL("https://openrouter.ai/auth");
  url.search = new URLSearchParams({
    callback_url: callback.toString(),
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: "S256",
  }).toString();
  const res = NextResponse.redirect(url);
  res.cookies.set("or_pkce", verifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/llm/openrouter",
    maxAge: 600,
  });
  return res;
}
