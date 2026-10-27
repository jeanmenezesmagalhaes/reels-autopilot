import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/auth";
import { igExchangeCode } from "@/lib/instagram";
import { InstagramTakenError, saveIgAccount } from "@/lib/instagram-account";
import { currentWorkspace } from "@/lib/workspace";
import { IG_RETURN_COOKIE, IG_STATE_COOKIE, igRedirectUri, igReturnPath } from "@/lib/instagram-oauth";

export const dynamic = "force-dynamic";

// Instagram sends the member back here; the token goes straight into the database,
// encrypted, and is never sent to the browser.
export async function GET(req: Request) {
  const done = (result: "ok" | "erro" | "em-uso") => {
    const from = req.headers.get("cookie")?.match(new RegExp(`(?:^|; )${IG_RETURN_COOKIE}=([^;]+)`))?.[1];
    const res = NextResponse.redirect(new URL(igReturnPath(from, result), req.url));
    res.cookies.delete({ name: IG_STATE_COOKIE, path: "/api/instagram" });
    res.cookies.delete({ name: IG_RETURN_COOKIE, path: "/api/instagram" });
    return res;
  };
  const ws = await currentWorkspace();
  if (!ws) return NextResponse.redirect(new URL("/login", req.url));
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = req.headers.get("cookie")?.match(new RegExp(`(?:^|; )${IG_STATE_COOKIE}=([^;]+)`))?.[1];
  if (!code || !state || !expected || !safeEqual(state, decodeURIComponent(expected))) return done("erro");
  try {
    await saveIgAccount(ws.workspaceId, await igExchangeCode(code, igRedirectUri(req)));
    return done("ok");
  } catch (err) {
    if (err instanceof InstagramTakenError) return done("em-uso");
    console.error("instagram connect failed:", (err as Error).message);
    return done("erro");
  }
}
