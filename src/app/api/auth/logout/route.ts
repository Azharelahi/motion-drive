import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  clearSessionToken,
  getAdminIdFromSession,
  getSessionToken,
} from "@/lib/auth";
import { requireAdmin } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const token = await getSessionToken();
  if (token) {
    const adminId = await getAdminIdFromSession(token);
    if (adminId) await clearSessionToken(adminId);
  }

  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.headers.set("Set-Cookie", clearSessionCookie());
  return response;
}
