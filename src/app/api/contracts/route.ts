import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { contractInputSchema } from "@/lib/validation";
import { requireAdmin } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

const newContractSchema = contractInputSchema
  .omit({ contractNumber: true, status: true })
  .extend({ paymentMethod: z.enum(["Bank Transfer", "PayID"]) });

class RentalRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RentalRequestError";
  }
}

function melbourneYear(): number {
  return Number(
    new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Melbourne",
      year: "numeric",
    }).format(new Date()),
  );
}

function dateOnly(value: string | null | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function nextContractNumber(contractNumbers: string[], year: number): string {
  const prefix = `MD-${year}-`;
  const lastSequence = contractNumbers.reduce((maximum, contractNumber) => {
    const match = new RegExp(`^MD-${year}-(\\d+)$`).exec(contractNumber);
    const sequence = match ? Number(match[1]) : 0;
    return Number.isSafeInteger(sequence) ? Math.max(maximum, sequence) : maximum;
  }, 0);
  const sequence = lastSequence + 1;
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const contracts = await prisma.contract.findMany({
      include: {
        driver: { select: { id: true, name: true, mobile: true } },
        vehicle: { select: { id: true, registration: true, make: true, model: true } },
      },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(
      { contracts },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Contract register load failed", error);
    return NextResponse.json(
      { error: "Could not load saved contracts." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = newContractSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid rental details.", details: z.prettifyError(parsed.error) },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const year = melbourneYear();

  try {
    const contract = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`motion-drive-contract-number:${year}`}))`;

      const vehicle = await transaction.vehicle.findUnique({
        where: { id: input.vehicleId },
      });
      if (!vehicle) throw new RentalRequestError("Selected vehicle was not found.", 404);

      const driver = await transaction.driver.findUnique({
        where: { id: input.driverId },
      });
      if (!driver) throw new RentalRequestError("Selected driver was not found.", 404);

      const activeVehicleContract = await transaction.contract.findFirst({
        where: { vehicleId: vehicle.id, status: "Active" },
        include: { driver: { select: { name: true } } },
      });
      if (activeVehicleContract) {
        throw new RentalRequestError(
          `This vehicle is already rented by ${activeVehicleContract.driver.name}.`,
          409,
        );
      }

      const activeDriverContract = await transaction.contract.findFirst({
        where: { driverId: driver.id, status: "Active" },
        include: { vehicle: { select: { registration: true } } },
      });
      if (activeDriverContract) {
        throw new RentalRequestError(
          `This driver already has an active rental with vehicle ${activeDriverContract.vehicle.registration}.`,
          409,
        );
      }

      const prefix = `MD-${year}-`;
      const contractNumbers = await transaction.contract.findMany({
        where: { contractNumber: { startsWith: prefix } },
        select: { contractNumber: true },
      });
      const contractNumber = nextContractNumber(
        contractNumbers.map(({ contractNumber: number }) => number),
        year,
      );
      const initialEndDate = dateOnly(input.initialEndDate ?? input.endDate);

      const createdContract = await transaction.contract.create({
        data: {
          contractNumber,
          vehicleId: vehicle.id,
          driverId: driver.id,
          status: "Active",
          agreementDate: dateOnly(input.agreementDate),
          startDate: dateOnly(input.startDate)!,
          endDate: dateOnly(input.endDate),
          initialEndDate,
          weeklyRent: input.weeklyRent,
          bond: input.bond ?? vehicle.bond,
          excess: input.excess ?? vehicle.excess,
          kmAllowance: input.kmAllowance,
          term: input.term,
          noticePeriod: input.noticePeriod,
          paymentFrequency: input.paymentFrequency,
          paymentMethod: input.paymentMethod,
          rideshareUse: input.rideshareUse,
          privateUse: input.privateUse,
        },
      });

      await transaction.vehicle.update({
        where: { id: vehicle.id },
        data: { status: "Rented" },
      });
      await transaction.driver.update({
        where: { id: driver.id },
        data: { status: "Current" },
      });

      return createdContract;
    });

    return NextResponse.json({ contract }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RentalRequestError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "The vehicle or driver already has an active rental. Refresh and try again." },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      }
    }

    console.error("Rental creation failed", error);
    return NextResponse.json(
      { error: "Could not create the rental. Check the server logs for details." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
