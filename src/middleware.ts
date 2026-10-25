import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/session";

// Page gate. "/" is the owner's dashboard, "/espera" the waitlist screen; "/login",
// "/privacidade" and "/termos" are public. API routes are excluded here and check their own secrets.
export async function middleware(req: NextRequest) {
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  const path = req.nextUrl.pathname;
  const home = session?.role === "owner" ? "/" : "/espera";
  const to = (p: string) => NextResponse.redirect(new URL(p, req.url));

  if (path === "/privacidade" || path === "/termos") return NextResponse.next(); // public, linked from Google's consent screen
  if (path === "/login") return session ? to(home) : NextResponse.next();
  if (!session) return req.method === "GET" ? to("/login") : new NextResponse("Unauthorized", { status: 401 });
  if (path === "/espera") return session.role === "waitlist" ? NextResponse.next() : to("/");
  // Everything else belongs to the owner.
  if (session.role !== "owner") return req.method === "GET" ? to("/espera") : new NextResponse("Forbidden", { status: 403 });
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/|_next/|favicon.ico).*)"],
};
