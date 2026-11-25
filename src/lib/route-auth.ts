import { NextResponse } from "next/server";
import { getAdminIdFromSession, getSessionToken } from "@/lib/auth";

export async function requireAdmin(): Promise<NextResponse | null> {
  const token = await getSessionToken();
  if (!token || !(await getAdminIdFromSession(token))) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  return null;
}
