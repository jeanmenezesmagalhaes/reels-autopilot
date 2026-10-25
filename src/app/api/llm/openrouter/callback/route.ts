import { NextResponse } from "next/server";
import { saveLlmKey } from "@/lib/llm";
import { isOwnerRequest } from "@/lib/owner";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const done = (r: "ok" | "erro") => {
    const res = NextResponse.redirect(new URL(`/ajustes?ia=${r}`, req.url));
    res.cookies.delete({ name: "or_pkce", path: "/api/llm/openrouter" });
    return res;
  };
  if (!(await isOwnerRequest(req))) return NextResponse.redirect(new URL("/login", req.url));
  const code = new URL(req.url).searchParams.get("code");
  const verifier = req.headers.get("cookie")?.match(/(?:^|; )or_pkce=([^;]+)/)?.[1];
  if (!code || !verifier) return done("erro");
  try {
    const res = await fetch("https://openrouter.ai/api/v1/auth/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, code_verifier: decodeURIComponent(verifier), code_challenge_method: "S256" }),
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || typeof json.key !== "string") return done("erro");
    await saveLlmKey("openrouter", json.key, "oauth");
    return done("ok");
  } catch (err) {
    console.error("openrouter connect failed:", (err as Error).message);
    return done("erro");
  }
}
