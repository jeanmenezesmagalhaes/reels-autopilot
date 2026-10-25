import { NextResponse } from "next/server";
import { randomToken } from "@/lib/google";
import { igAuthorizeUrl } from "@/lib/instagram";
import { IG_STATE_COOKIE, igRedirectUri } from "@/lib/instagram-oauth";
import { isOwnerRequest } from "@/lib/owner";

export const dynamic = "force-dynamic";

// Starts "Conectar Instagram". Owner only.
export async function GET(req: Request) {
  if (!(await isOwnerRequest(req))) return NextResponse.redirect(new URL("/login", req.url));
  if (!process.env.IG_APP_ID || !process.env.IG_APP_SECRET) return NextResponse.redirect(new URL("/?ig=erro", req.url));
  const state = randomToken();
  const res = NextResponse.redirect(igAuthorizeUrl(igRedirectUri(req), state));
  res.cookies.set(IG_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/instagram",
    maxAge: 600,
  });
  return res;
}
