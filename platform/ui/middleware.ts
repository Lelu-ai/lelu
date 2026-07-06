import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/dashboard", "/audit", "/policies", "/traces", "/api-key", "/api/policies", "/admin"];
const SESSION_COOKIE = "lelu_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/audit/:path*", "/policies/:path*", "/traces/:path*", "/api-key/:path*", "/api/policies/:path*", "/admin/:path*"],
};
