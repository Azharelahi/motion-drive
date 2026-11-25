import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { driverInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const driverPatchSchema = driverInputSchema.partial();

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
  const { id } = await context.params;
  try {
    const driver = await prisma.driver.findUnique({
      where: { id },
      include: {
        contracts: {
          include: {
            vehicle: {
              select: { id: true, registration: true, model: true, year: true, colour: true },
            },
          },
          orderBy: { startDate: "desc" },
        },
        documents: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!driver) {
      return NextResponse.json({ error: "Driver not found." }, { status: 404 });
    }

    const responseDriver = {
      ...driver,
      documents: driver.documents.map((document) => ({
        ...document,
        sizeBytes: document.sizeBytes.toString(),
      })),
    };
    return NextResponse.json(
      { driver: responseDriver },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Driver profile load failed", error);
    return NextResponse.json({ error: "Could not load the driver." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const parsed = driverPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid driver data.", details: z.prettifyError(parsed.error) },
        { status: 400 },
      );
    }
    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: "No driver fields were supplied." }, { status: 400 });
    }

    const input = parsed.data;
    const data: Record<string, unknown> = {};
    for (const key of [
      "name",
      "mobile",
      "email",
      "address",
      "licenceNumber",
      "licenceState",
      "abn",
      "emergencyContact",
      "rideshareAccreditation",
      "status",
      "notes",
    ] as const) {
      if (hasOwn(input, key)) data[key] = input[key] ?? null;
    }

    for (const key of [
      "dateOfBirth",
      "licenceExpiry",
      "rideshareAccreditationExpiry",
    ] as const) {
      if (hasOwn(input, key)) data[key] = isoDateOrNull(input[key]);
    }

    const driver = await prisma.driver.update({ where: { id }, data });
    return NextResponse.json({ driver }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Driver not found." }, { status: 404 });
      }
    }
    console.error("Driver update failed", error);
    return NextResponse.json({ error: "Could not update driver." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const driver = await prisma.driver.findUnique({
      where: { id },
      select: { id: true, _count: { select: { contracts: true } } },
    });
    if (!driver) {
      return NextResponse.json({ error: "Driver not found." }, { status: 404 });
    }
    if (driver._count.contracts > 0) {
      return NextResponse.json(
        { error: "This driver cannot be deleted because they are linked to one or more contracts." },
        { status: 409 },
      );
    }

    await prisma.driver.delete({ where: { id } });
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Driver not found." }, { status: 404 });
    }
    console.error("Driver delete failed", error);
    return NextResponse.json({ error: "Could not delete driver." }, { status: 500 });
  }
}
