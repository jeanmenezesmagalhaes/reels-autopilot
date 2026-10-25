import { readSession, SESSION_COOKIE } from "./session";

// API routes sit outside the page middleware; this checks the owner session for them.
export async function isOwnerRequest(req: Request) {
  const cookie = req.headers.get("cookie")?.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`))?.[1];
  const session = await readSession(cookie ? decodeURIComponent(cookie) : undefined);
  return session?.role === "owner";
}
