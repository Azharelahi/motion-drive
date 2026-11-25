import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ContractActionError, endContract } from "@/lib/contract-lifecycle";
import { requireAdmin } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  try {
    const contract = await endContract(id);
    return NextResponse.json(
      { contract },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ContractActionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json(
        { error: "Contract, vehicle, or driver not found." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    console.error("Contract end failed", error);
    return NextResponse.json(
      { error: "Could not end the contract." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
