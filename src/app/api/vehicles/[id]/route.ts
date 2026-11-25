import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { vehicleInputSchema } from "@/lib/validation";
import { requireAdmin } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

const vehiclePatchSchema = vehicleInputSchema.partial();

function isoDateOrNull(value: string | null | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function hasOwn(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        contracts: {
          include: {
            driver: {
              select: { id: true, name: true, mobile: true },
            },
          },
          orderBy: { startDate: "desc" },
        },
        documents: {
          select: {
            id: true,
            documentType: true,
            originalName: true,
            expiryDate: true,
            createdAt: true,
            sizeBytes: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!vehicle) {
      return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
    }
    const responseVehicle = {
      ...vehicle,
      documents: vehicle.documents.map((document) => ({
        ...document,
        sizeBytes: document.sizeBytes.toString(),
      })),
    };
    return NextResponse.json(
      { vehicle: responseVehicle },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Vehicle profile load failed", error);
    return NextResponse.json({ error: "Could not load the vehicle." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const parsed = vehiclePatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid vehicle data.", details: z.prettifyError(parsed.error) },
        { status: 400 },
      );
    }
    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: "No vehicle fields were supplied." }, { status: 400 });
    }

    const input = parsed.data;
    const data: Record<string, unknown> = {};
    for (const key of [
      "registration",
      "make",
      "model",
      "fuelType",
      "year",
      "colour",
      "vin",
      "status",
      "weeklyRent",
      "kmAllowance",
      "pickupLocation",
      "odometer",
      "nextServiceKm",
      "notes",
    ] as const) {
      if (hasOwn(input, key)) data[key] = input[key] ?? null;
    }

    if (hasOwn(input, "bond")) data.bond = input.bond ?? 500;
    if (hasOwn(input, "excess")) data.excess = input.excess ?? 0;

    for (const key of ["registrationExpiry", "insuranceExpiry", "inspectionExpiry"] as const) {
      if (hasOwn(input, key)) data[key] = isoDateOrNull(input[key]);
    }

    const vehicle = await prisma.vehicle.update({ where: { id }, data });
    return NextResponse.json({ vehicle }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
      }
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "A vehicle with this registration already exists." },
          { status: 409 },
        );
      }
    }
    console.error("Vehicle update failed", error);
    return NextResponse.json({ error: "Could not update vehicle." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      select: { id: true, _count: { select: { contracts: true } } },
    });
    if (!vehicle) {
      return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
    }
    if (vehicle._count.contracts > 0) {
      return NextResponse.json(
        { error: "This vehicle cannot be deleted because it is linked to one or more contracts." },
        { status: 409 },
      );
    }

    await prisma.vehicle.delete({ where: { id } });
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
    }
    console.error("Vehicle delete failed", error);
    return NextResponse.json({ error: "Could not delete vehicle." }, { status: 500 });
  }
}
