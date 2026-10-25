import { NextResponse, type NextRequest } from "next/server";
import { isValidSession, SESSION_COOKIE } from "@/lib/session";

// Session gate for the dashboard. API routes use their own bearer secrets.
export async function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return new NextResponse("DASHBOARD_PASSWORD not set", { status: 503 });

  const signedIn = await isValidSession(req.cookies.get(SESSION_COOKIE)?.value, password);
  const onLogin = req.nextUrl.pathname === "/login";

  if (onLogin) return signedIn ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  if (signedIn) return NextResponse.next();
  // Pages go to the login screen; anything else (server actions, fetches) is refused.
  if (req.method === "GET") return NextResponse.redirect(new URL("/login", req.url));
  return new NextResponse("Unauthorized", { status: 401 });
}

export const config = {
  matcher: ["/((?!api/|_next/|favicon.ico).*)"],
};
