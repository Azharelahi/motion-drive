import { prisma } from "@/lib/db";

export class ContractActionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ContractActionError";
  }
}

function melbourneDate(): Date {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
}

export async function endContract(id: string) {
  return prisma.$transaction(async (transaction) => {
    const contract = await transaction.contract.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        vehicleId: true,
        driverId: true,
        endDate: true,
        initialEndDate: true,
      },
    });
    if (!contract) throw new ContractActionError("Contract not found.", 404);
    if (contract.status !== "Active") {
      throw new ContractActionError("Only an active contract can be marked ended.", 409);
    }

    const now = new Date();
    const update = await transaction.contract.updateMany({
      where: { id, status: "Active" },
      data: {
        status: "Ended",
        endedAt: now,
        endDate: melbourneDate(),
        initialEndDate: contract.initialEndDate ?? contract.endDate,
      },
    });
    if (update.count !== 1) {
      throw new ContractActionError("This contract has already changed. Refresh and try again.", 409);
    }

    const [otherVehicleRental, otherDriverRental] = await Promise.all([
      transaction.contract.findFirst({
        where: { vehicleId: contract.vehicleId, status: "Active", id: { not: id } },
        select: { id: true },
      }),
      transaction.contract.findFirst({
        where: { driverId: contract.driverId, status: "Active", id: { not: id } },
        select: { id: true },
      }),
    ]);

    await Promise.all([
      transaction.vehicle.update({
        where: { id: contract.vehicleId },
        data: { status: otherVehicleRental ? "Rented" : "Available" },
      }),
      transaction.driver.update({
        where: { id: contract.driverId },
        data: { status: otherDriverRental ? "Current" : "Ended" },
      }),
    ]);

    return transaction.contract.findUniqueOrThrow({ where: { id } });
  });
}

export async function reopenContract(id: string) {
  return prisma.$transaction(async (transaction) => {
    const contract = await transaction.contract.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        vehicleId: true,
        driverId: true,
        initialEndDate: true,
      },
    });
    if (!contract) throw new ContractActionError("Contract not found.", 404);
    if (contract.status !== "Ended") {
      throw new ContractActionError("Only an ended contract can be reopened.", 409);
    }

    const activeVehicleRental = await transaction.contract.findFirst({
      where: { vehicleId: contract.vehicleId, status: "Active", id: { not: id } },
      select: { contractNumber: true },
    });
    if (activeVehicleRental) {
      throw new ContractActionError(
        `This vehicle is already assigned to active contract ${activeVehicleRental.contractNumber}.`,
        409,
      );
    }

    const activeDriverRental = await transaction.contract.findFirst({
      where: { driverId: contract.driverId, status: "Active", id: { not: id } },
      select: { contractNumber: true },
    });
    if (activeDriverRental) {
      throw new ContractActionError(
        `This driver already has active contract ${activeDriverRental.contractNumber}.`,
        409,
      );
    }

    const update = await transaction.contract.updateMany({
      where: { id, status: "Ended" },
      data: {
        status: "Active",
        endedAt: null,
        endDate: contract.initialEndDate,
      },
    });
    if (update.count !== 1) {
      throw new ContractActionError("This contract has already changed. Refresh and try again.", 409);
    }

    await Promise.all([
      transaction.vehicle.update({
        where: { id: contract.vehicleId },
        data: { status: "Rented" },
      }),
      transaction.driver.update({
        where: { id: contract.driverId },
        data: { status: "Current" },
      }),
    ]);

    return transaction.contract.findUniqueOrThrow({ where: { id } });
  });
}
