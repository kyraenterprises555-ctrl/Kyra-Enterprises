import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET =
  process.env.JWT_SECRET || "kyra_enterprises_production_jwt_secret_key_9876543210_enterprise_secure";
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);
const AUTH_COOKIE_NAME = "kyra_session";

// Public endpoints (cron endpoint validates CRON_SECRET independently)
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/seed", "/api/cron/payment-reminders"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/images") ||
    pathname.includes(".") ||
    PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/"))
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    const role = payload.role as string;

    // Admin-only routes
    if (
      (pathname.startsWith("/users") ||
        pathname.startsWith("/api/users") ||
        pathname.startsWith("/audit-logs") ||
        pathname.startsWith("/api/audit-logs") ||
        pathname.startsWith("/settings")) &&
      role !== "admin"
    ) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Manager & Admin routes
    if (
      (pathname.startsWith("/products/bulk-upload") ||
        pathname.startsWith("/inventory") ||
        pathname.startsWith("/purchases") ||
        pathname.startsWith("/reports")) &&
      role === "billing_staff"
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", (payload.userId as string) || "");
    requestHeaders.set("x-user-role", role || "");
    requestHeaders.set("x-user-name", (payload.name as string) || "");

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Session expired or invalid" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
