import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { swapInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const newSwapSchema = swapInputSchema.omit({ swapNumber: true }).superRefine((input, context) => {
    if (input.driverOneId === input.driverTwoId) {
      context.addIssue({
        code: "custom",
        message: "Choose two different drivers.",
        path: ["driverTwoId"],
      });
    }
    if (input.vehicleOneId === input.vehicleTwoId) {
      context.addIssue({
        code: "custom",
        message: "Choose two different vehicles.",
        path: ["vehicleTwoId"],
      });
    }
  });

class SwapRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SwapRequestError";
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

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function nextSwapNumber(
  year: number,
  existingSwapNumbers: string[],
  existingContractNumbers: string[],
): string {
  const prefix = `MD-SWAP-${year}-`;
  const swapPattern = new RegExp(`^MD-SWAP-${year}-(\\d+)$`);
  const contractPattern = new RegExp(`^MD-SWAP-${year}-(\\d+)-[AB]$`);
  const lastSequence = [...existingSwapNumbers, ...existingContractNumbers].reduce(
    (maximum, number) => {
      const match = swapPattern.exec(number) ?? contractPattern.exec(number);
      const sequence = match ? Number(match[1]) : 0;
      return Number.isSafeInteger(sequence) ? Math.max(maximum, sequence) : maximum;
    },
    0,
  );
  return `${prefix}${String(lastSequence + 1).padStart(3, "0")}`;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = newSwapSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid vehicle swap details.", details: z.prettifyError(parsed.error) },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const year = melbourneYear();
  const swapDate = dateOnly(input.swapDate);

  try {
    const result = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`motion-drive-swap-number:${year}`}))`;

      const [driverOne, driverTwo, vehicleOne, vehicleTwo] = await Promise.all([
        transaction.driver.findUnique({ where: { id: input.driverOneId } }),
        transaction.driver.findUnique({ where: { id: input.driverTwoId } }),
        transaction.vehicle.findUnique({ where: { id: input.vehicleOneId } }),
        transaction.vehicle.findUnique({ where: { id: input.vehicleTwoId } }),
      ]);
      if (!driverOne || !driverTwo) {
        throw new SwapRequestError("One or both selected drivers were not found.", 404);
      }
      if (!vehicleOne || !vehicleTwo) {
        throw new SwapRequestError("One or both selected vehicles were not found.", 404);
      }

      const [activeContractOne, activeContractTwo] = await Promise.all([
        transaction.contract.findFirst({
          where: { driverId: driverOne.id, status: "Active" },
          include: { vehicle: true },
        }),
        transaction.contract.findFirst({
          where: { driverId: driverTwo.id, status: "Active" },
          include: { vehicle: true },
        }),
      ]);
      if (!activeContractOne || !activeContractTwo) {
        throw new SwapRequestError("Both drivers must have an active vehicle rental to swap.", 409);
      }
      if (activeContractOne.vehicleId !== vehicleOne.id) {
        throw new SwapRequestError(
          `${driverOne.name} is not currently renting ${vehicleOne.registration}. Refresh and try again.`,
          409,
        );
      }
      if (activeContractTwo.vehicleId !== vehicleTwo.id) {
        throw new SwapRequestError(
          `${driverTwo.name} is not currently renting ${vehicleTwo.registration}. Refresh and try again.`,
          409,
        );
      }
      if (swapDate < activeContractOne.startDate || swapDate < activeContractTwo.startDate) {
        throw new SwapRequestError("Swap date cannot be before either rental start date.", 400);
      }

      const swapPrefix = `MD-SWAP-${year}-`;
      const [existingSwaps, existingSwapContracts] = await Promise.all([
        transaction.vehicleSwap.findMany({
          where: { swapNumber: { startsWith: swapPrefix } },
          select: { swapNumber: true },
        }),
        transaction.contract.findMany({
          where: { contractNumber: { startsWith: swapPrefix } },
          select: { contractNumber: true },
        }),
      ]);
      const swapNumber = nextSwapNumber(
        year,
        existingSwaps.map(({ swapNumber: number }) => number),
        existingSwapContracts.map(({ contractNumber }) => contractNumber),
      );

      const now = new Date();
      const endedOne = await transaction.contract.updateMany({
        where: { id: activeContractOne.id, status: "Active" },
        data: {
          status: "Ended",
          endedAt: now,
          endDate: swapDate,
          initialEndDate: activeContractOne.initialEndDate ?? activeContractOne.endDate,
        },
      });
      const endedTwo = await transaction.contract.updateMany({
        where: { id: activeContractTwo.id, status: "Active" },
        data: {
          status: "Ended",
          endedAt: now,
          endDate: swapDate,
          initialEndDate: activeContractTwo.initialEndDate ?? activeContractTwo.endDate,
        },
      });
      if (endedOne.count !== 1 || endedTwo.count !== 1) {
        throw new SwapRequestError("An active rental changed during the swap. Refresh and retry.", 409);
      }

      const swap = await transaction.vehicleSwap.create({
        data: {
          swapNumber,
          swapDate,
          driverOneId: driverOne.id,
          driverTwoId: driverTwo.id,
          vehicleOneId: vehicleOne.id,
          vehicleTwoId: vehicleTwo.id,
          newRentOne: input.newRentOne,
          newRentTwo: input.newRentTwo,
          notes: input.notes ?? null,
        },
      });

      const newContractOne = await transaction.contract.create({
        data: {
          contractNumber: `${swapNumber}-A`,
          vehicleId: vehicleTwo.id,
          driverId: driverOne.id,
          status: "Active",
          swapId: swap.id,
          swapLeg: "A",
          agreementDate: swapDate,
          startDate: swapDate,
          endDate: null,
          initialEndDate: null,
          weeklyRent: input.newRentOne,
          bond: vehicleTwo.bond,
          excess: vehicleTwo.excess,
          kmAllowance: vehicleTwo.kmAllowance,
          term: activeContractOne.term,
          noticePeriod: activeContractOne.noticePeriod,
          paymentFrequency: activeContractOne.paymentFrequency,
          paymentMethod: activeContractOne.paymentMethod,
          rideshareUse: activeContractOne.rideshareUse,
          privateUse: activeContractOne.privateUse,
        },
        include: {
          driver: { select: { id: true, name: true } },
          vehicle: { select: { id: true, registration: true, model: true } },
        },
      });

      const newContractTwo = await transaction.contract.create({
        data: {
          contractNumber: `${swapNumber}-B`,
          vehicleId: vehicleOne.id,
          driverId: driverTwo.id,
          status: "Active",
          swapId: swap.id,
          swapLeg: "B",
          agreementDate: swapDate,
          startDate: swapDate,
          endDate: null,
          initialEndDate: null,
          weeklyRent: input.newRentTwo,
          bond: vehicleOne.bond,
          excess: vehicleOne.excess,
          kmAllowance: vehicleOne.kmAllowance,
          term: activeContractTwo.term,
          noticePeriod: activeContractTwo.noticePeriod,
          paymentFrequency: activeContractTwo.paymentFrequency,
          paymentMethod: activeContractTwo.paymentMethod,
          rideshareUse: activeContractTwo.rideshareUse,
          privateUse: activeContractTwo.privateUse,
        },
        include: {
          driver: { select: { id: true, name: true } },
          vehicle: { select: { id: true, registration: true, model: true } },
        },
      });

      await Promise.all([
        transaction.vehicle.update({
          where: { id: vehicleOne.id },
          data: { status: "Rented" },
        }),
        transaction.vehicle.update({
          where: { id: vehicleTwo.id },
          data: { status: "Rented" },
        }),
        transaction.driver.update({
          where: { id: driverOne.id },
          data: { status: "Current" },
        }),
        transaction.driver.update({
          where: { id: driverTwo.id },
          data: { status: "Current" },
        }),
      ]);

      return {
        swap,
        contracts: [newContractOne, newContractTwo],
        endedContractIds: [activeContractOne.id, activeContractTwo.id],
      };
    });

    return NextResponse.json(
      {
        swap: result.swap,
        contracts: result.contracts,
        endedContractIds: result.endedContractIds,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof SwapRequestError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "A vehicle or driver is already assigned to another active rental." },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      }
      if (error.code === "P2003" || error.code === "P2025") {
        return NextResponse.json(
          { error: "A selected driver or vehicle no longer exists." },
          { status: 404, headers: { "Cache-Control": "no-store" } },
        );
      }
    }

    console.error("Vehicle swap failed", error);
    return NextResponse.json(
      { error: "Could not complete the vehicle swap." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
