import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { driverInputSchema } from "@/lib/validation";
import { requireAdmin } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

function isoDateOrNull(value: string | null | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function driverData(input: z.infer<typeof driverInputSchema>) {
  return {
    name: input.name,
    mobile: input.mobile,
    email: input.email ?? null,
    dateOfBirth: isoDateOrNull(input.dateOfBirth),
    address: input.address ?? null,
    licenceNumber: input.licenceNumber ?? null,
    licenceState: input.licenceState ?? null,
    abn: input.abn ?? null,
    emergencyContact: input.emergencyContact ?? null,
    rideshareAccreditation: input.rideshareAccreditation ?? null,
    licenceExpiry: isoDateOrNull(input.licenceExpiry),
    rideshareAccreditationExpiry: isoDateOrNull(input.rideshareAccreditationExpiry),
    status: input.status ?? "Ended",
    notes: input.notes ?? null,
  };
}

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const drivers = await prisma.driver.findMany({
      include: {
        contracts: {
          where: { status: "Active" },
          include: {
            vehicle: {
              select: { id: true, registration: true, model: true, year: true, colour: true },
            },
          },
          orderBy: { startDate: "desc" },
        },
        _count: { select: { documents: true } },
      },
      orderBy: [{ name: "asc" }],
    });
    return NextResponse.json({ drivers }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Driver list failed", error);
    return NextResponse.json(
      { error: "Could not load drivers." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const parsed = driverInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid driver data.", details: z.prettifyError(parsed.error) },
        { status: 400 },
      );
    }

    const driver = await prisma.driver.create({ data: driverData(parsed.data) });
    return NextResponse.json(
      { driver },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Driver creation failed", error);
    return NextResponse.json({ error: "Could not create driver." }, { status: 500 });
  }
}
