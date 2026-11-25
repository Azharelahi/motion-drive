import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  return NextResponse.json({ authenticated: true }, { headers: { "Cache-Control": "no-store" } });
}
