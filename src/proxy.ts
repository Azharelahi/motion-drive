import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminIdFromSession } from "@/lib/auth";

const SESSION_COOKIE = "md_session";
const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function normalizedPath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000");
  }
  return response;
}

function isCrossOriginMutation(request: NextRequest): boolean {
  if (!STATE_CHANGING_METHODS.has(request.method)) return false;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin !== request.nextUrl.origin;
  } catch {
    return true;
  }
}

export async function proxy(request: NextRequest) {
  const pathname = normalizedPath(request.nextUrl.pathname);
  if (isCrossOriginMutation(request)) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: "Cross-origin requests are not allowed." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      ),
    );
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value ?? null;

  if (PUBLIC_PATHS.has(pathname)) {
    if (pathname === "/login" && token && (await getAdminIdFromSession(token))) {
      return withSecurityHeaders(NextResponse.redirect(new URL("/", request.url)));
    }
    return withSecurityHeaders(NextResponse.next());
  }

  if (pathname.startsWith("/api/")) {
    if (!token) {
      return withSecurityHeaders(
        NextResponse.json(
          { error: "Authentication required." },
          { status: 401, headers: { "Cache-Control": "no-store" } },
        ),
      );
    }
    return withSecurityHeaders(NextResponse.next());
  }

  const adminId = token ? await getAdminIdFromSession(token) : null;
  if (!adminId) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callback", pathname);
    return withSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|pdf\\.worker\\.min\\.mjs).*)",
  ],
};
