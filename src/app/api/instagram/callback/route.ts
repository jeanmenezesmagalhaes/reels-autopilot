import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/auth";
import { igExchangeCode } from "@/lib/instagram";
import { saveIgAccount } from "@/lib/instagram-account";
import { isOwnerRequest } from "@/lib/owner";
import { IG_STATE_COOKIE, igRedirectUri } from "@/lib/instagram-oauth";

export const dynamic = "force-dynamic";

// Instagram sends the owner back here; the token goes straight into the database,
// encrypted, and is never sent to the browser.
export async function GET(req: Request) {
  const done = (result: "ok" | "erro") => {
    const res = NextResponse.redirect(new URL(`/ajustes?ig=${result}`, req.url));
    res.cookies.delete({ name: IG_STATE_COOKIE, path: "/api/instagram" });
    return res;
  };
  if (!(await isOwnerRequest(req))) return NextResponse.redirect(new URL("/login", req.url));
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = req.headers.get("cookie")?.match(new RegExp(`(?:^|; )${IG_STATE_COOKIE}=([^;]+)`))?.[1];
  if (!code || !state || !expected || !safeEqual(state, decodeURIComponent(expected))) return done("erro");
  try {
    await saveIgAccount(await igExchangeCode(code, igRedirectUri(req)));
    return done("ok");
  } catch (err) {
    console.error("instagram connect failed:", (err as Error).message);
    return done("erro");
  }
}
