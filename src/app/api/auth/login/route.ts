import { NextResponse } from "next/server";
import { z } from "zod";
import {
  authenticateAdmin,
  checkLoginRateLimit,
  clearLoginRateLimit,
  createSessionCookie,
  generateToken,
  setSessionToken,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(256),
});

function getClientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0].trim() || "unknown";
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = checkLoginRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Too many login attempts. Try again in ${rateLimit.remainingSeconds} seconds.` },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid admin username and password." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const admin = await authenticateAdmin(parsed.data.username, parsed.data.password);
  if (!admin) {
    return NextResponse.json(
      { error: "Invalid username or password." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const token = generateToken();
  await setSessionToken(admin.id, token);
  clearLoginRateLimit(ip);

  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.headers.set("Set-Cookie", createSessionCookie(token));
  return response;
}
