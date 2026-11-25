import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ContractActionError, reopenContract } from "@/lib/contract-lifecycle";
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
    const contract = await reopenContract(id);
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
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "The vehicle or driver has been assigned to another active rental. Refresh and try again." },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      }
      if (error.code === "P2025") {
        return NextResponse.json(
          { error: "Contract, vehicle, or driver not found." },
          { status: 404, headers: { "Cache-Control": "no-store" } },
        );
      }
    }

    console.error("Contract reopen failed", error);
    return NextResponse.json(
      { error: "Could not reopen the contract." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
