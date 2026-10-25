import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/auth";

// Basic auth for the dashboard. API routes use their own bearer secrets.
export function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return new NextResponse("DASHBOARD_PASSWORD not set", { status: 503 });

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const given = decoded.slice(decoded.indexOf(":") + 1);
    if (safeEqual(given, password)) return NextResponse.next();
  }
  return new NextResponse("Auth required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="reels-autopilot"' },
  });
}

export const config = {
  matcher: ["/((?!api/|_next/|favicon.ico).*)"],
};
