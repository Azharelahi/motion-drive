import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { vehicleInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

function isoDateOrNull(value: string | null | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function vehicleData(input: z.infer<typeof vehicleInputSchema>) {
  return {
    registration: input.registration,
    make: input.make ?? null,
    model: input.model,
    fuelType: input.fuelType ?? null,
    year: input.year ?? null,
    colour: input.colour ?? null,
    vin: input.vin ?? null,
    status: input.status ?? "Available",
    weeklyRent: input.weeklyRent,
    bond: input.bond ?? 500,
    excess: input.excess ?? 0,
    kmAllowance: input.kmAllowance ?? "Unlimited",
    pickupLocation: input.pickupLocation ?? "Tarneit, VIC",
    odometer: input.odometer ?? null,
    nextServiceKm: input.nextServiceKm ?? null,
    registrationExpiry: isoDateOrNull(input.registrationExpiry),
    insuranceExpiry: isoDateOrNull(input.insuranceExpiry),
    inspectionExpiry: isoDateOrNull(input.inspectionExpiry),
    notes: input.notes ?? null,
  };
}

export async function GET() {
  try {
    const vehicles = await prisma.vehicle.findMany({
      include: {
        contracts: {
          where: { status: "Active" },
          include: { driver: true },
          orderBy: { startDate: "desc" },
        },
        _count: { select: { documents: true } },
      },
      orderBy: [{ registration: "asc" }],
    });
    return NextResponse.json({ vehicles }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Vehicle list failed", error);
    return NextResponse.json(
      { error: "Could not load vehicles." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const parsed = vehicleInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid vehicle data.", details: z.prettifyError(parsed.error) },
        { status: 400 },
      );
    }

    const vehicle = await prisma.vehicle.create({ data: vehicleData(parsed.data) });
    return NextResponse.json({ vehicle }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "A vehicle with this registration already exists." },
        { status: 409 },
      );
    }
    console.error("Vehicle creation failed", error);
    return NextResponse.json({ error: "Could not create vehicle." }, { status: 500 });
  }
}
