import { NextResponse } from "next/server";
import { randomToken } from "@/lib/google";
import { igAuthorizeUrl } from "@/lib/instagram";
import { IG_RETURN_COOKIE, IG_STATE_COOKIE, igRedirectUri, igReturnPath } from "@/lib/instagram-oauth";
import { currentWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// Starts "Conectar Instagram" for the signed-in member. `?voltar=comecar` comes back to the first-run flow.
export async function GET(req: Request) {
  if (!(await currentWorkspace())) return NextResponse.redirect(new URL("/login", req.url));
  const from = new URL(req.url).searchParams.get("voltar") ?? undefined;
  if (!process.env.IG_APP_ID || !process.env.IG_APP_SECRET) return NextResponse.redirect(new URL(igReturnPath(from, "erro"), req.url));
  const state = randomToken();
  const res = NextResponse.redirect(igAuthorizeUrl(igRedirectUri(req), state));
  const cookie = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/api/instagram", maxAge: 600 };
  res.cookies.set(IG_STATE_COOKIE, state, cookie);
  if (from === "comecar") res.cookies.set(IG_RETURN_COOKIE, "comecar", cookie);
  else res.cookies.delete({ name: IG_RETURN_COOKIE, path: "/api/instagram" });
  return res;
}
