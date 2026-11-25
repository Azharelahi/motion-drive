import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/db";
import { GET as listContracts } from "../../src/app/api/contracts/route";
import { POST as endContract } from "../../src/app/api/contracts/[id]/end/route";
import { POST as reopenContract } from "../../src/app/api/contracts/[id]/reopen/route";

const suffix = Date.now().toString().slice(-10);
const initialEndDate = new Date("2026-12-26T00:00:00.000Z");
let vehicleAId = "";
let vehicleBId = "";
let vehicleCId = "";
let driverAId = "";
let driverBId = "";
let driverCId = "";
let primaryContractId = "";
let driverConflictContractId = "";
let vehicleConflictContractId = "";

function routeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function actionRequest(url: string) {
  return new Request(url, { method: "POST" });
}

function melbourneToday(): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function createActiveContract(vehicleId: string, driverId: string, contractNumber: string) {
  const contract = await prisma.contract.create({
    data: {
      contractNumber,
      vehicleId,
      driverId,
      status: "Active",
      startDate: new Date("2026-11-25T00:00:00.000Z"),
      initialEndDate,
      endDate: initialEndDate,
      weeklyRent: 300,
    },
  });
  await prisma.$transaction([
    prisma.vehicle.update({ where: { id: vehicleId }, data: { status: "Rented" } }),
    prisma.driver.update({ where: { id: driverId }, data: { status: "Current" } }),
  ]);
  return contract.id;
}

beforeAll(async () => {
  await prisma.$connect();
  const [vehicleA, vehicleB, vehicleC, driverA, driverB, driverC] = await prisma.$transaction([
    prisma.vehicle.create({
      data: { registration: `LA${suffix}A`, model: "Lifecycle A", status: "Rented" },
    }),
    prisma.vehicle.create({
      data: { registration: `LA${suffix}B`, model: "Lifecycle B", status: "Available" },
    }),
    prisma.vehicle.create({
      data: { registration: `LA${suffix}C`, model: "Lifecycle C", status: "Available" },
    }),
    prisma.driver.create({
      data: { name: `Lifecycle Driver A ${suffix}`, mobile: `0411${suffix}`, status: "Current" },
    }),
    prisma.driver.create({
      data: { name: `Lifecycle Driver B ${suffix}`, mobile: `0412${suffix}`, status: "Ended" },
    }),
    prisma.driver.create({
      data: { name: `Lifecycle Driver C ${suffix}`, mobile: `0413${suffix}`, status: "Ended" },
    }),
  ]);
  vehicleAId = vehicleA.id;
  vehicleBId = vehicleB.id;
  vehicleCId = vehicleC.id;
  driverAId = driverA.id;
  driverBId = driverB.id;
  driverCId = driverC.id;
  const primary = await createActiveContract(vehicleAId, driverAId, `LC-${suffix}-A`);
  primaryContractId = primary;
});

afterAll(async () => {
  await prisma.$transaction(async (transaction) => {
    const contractIds = [
      primaryContractId,
      driverConflictContractId,
      vehicleConflictContractId,
    ].filter(Boolean);
    if (contractIds.length) {
      await transaction.contract.deleteMany({ where: { id: { in: contractIds } } });
    }
    const vehicleIds = [vehicleAId, vehicleBId, vehicleCId].filter(Boolean);
    if (vehicleIds.length) await transaction.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
    const driverIds = [driverAId, driverBId, driverCId].filter(Boolean);
    if (driverIds.length) await transaction.driver.deleteMany({ where: { id: { in: driverIds } } });
  });
  await prisma.$disconnect();
});

describe("saved contract lifecycle integration", () => {
  it("ends and reopens contracts, restoring statuses and blocking occupied resources", async () => {
    const listResponse = await listContracts();
    expect(listResponse.status).toBe(200);
    const listed = (await listResponse.json()) as {
      contracts: Array<{ id: string; contractNumber: string; driver: { name: string } }>;
    };
    expect(listed.contracts).toContainEqual(
      expect.objectContaining({
        id: primaryContractId,
        contractNumber: `LC-${suffix}-A`,
        driver: expect.objectContaining({ name: `Lifecycle Driver A ${suffix}` }),
      }),
    );

    const endResponse = await endContract(
      actionRequest(`http://localhost/api/contracts/${primaryContractId}/end`),
      routeContext(primaryContractId),
    );
    expect(endResponse.status).toBe(200);
    const ended = await prisma.contract.findUniqueOrThrow({ where: { id: primaryContractId } });
    expect(ended.status).toBe("Ended");
    expect(ended.endedAt).not.toBeNull();
    expect(ended.endDate?.toISOString().slice(0, 10)).toBe(melbourneToday());
    expect(ended.initialEndDate?.toISOString().slice(0, 10)).toBe("2026-12-26");
    const [availableVehicle, endedDriver] = await Promise.all([
      prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleAId } }),
      prisma.driver.findUniqueOrThrow({ where: { id: driverAId } }),
    ]);
    expect(availableVehicle.status).toBe("Available");
    expect(endedDriver.status).toBe("Ended");

    const reopenResponse = await reopenContract(
      actionRequest(`http://localhost/api/contracts/${primaryContractId}/reopen`),
      routeContext(primaryContractId),
    );
    expect(reopenResponse.status).toBe(200);
    const reopened = await prisma.contract.findUniqueOrThrow({ where: { id: primaryContractId } });
    expect(reopened.status).toBe("Active");
    expect(reopened.endedAt).toBeNull();
    expect(reopened.endDate?.toISOString().slice(0, 10)).toBe("2026-12-26");
    const [rentedVehicle, currentDriver] = await Promise.all([
      prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleAId } }),
      prisma.driver.findUniqueOrThrow({ where: { id: driverAId } }),
    ]);
    expect(rentedVehicle.status).toBe("Rented");
    expect(currentDriver.status).toBe("Current");

    const secondEndResponse = await endContract(
      actionRequest(`http://localhost/api/contracts/${primaryContractId}/end`),
      routeContext(primaryContractId),
    );
    expect(secondEndResponse.status).toBe(200);

    driverConflictContractId = await createActiveContract(
      vehicleBId,
      driverAId,
      `LC-${suffix}-B`,
    );
    const driverConflictResponse = await reopenContract(
      actionRequest(`http://localhost/api/contracts/${primaryContractId}/reopen`),
      routeContext(primaryContractId),
    );
    expect(driverConflictResponse.status).toBe(409);
    expect((await driverConflictResponse.json()).error).toContain("driver already has active contract");
    expect((await prisma.contract.findUniqueOrThrow({ where: { id: primaryContractId } })).status).toBe("Ended");
    expect((await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleAId } })).status).toBe("Available");

    const endCompetitorResponse = await endContract(
      actionRequest(`http://localhost/api/contracts/${driverConflictContractId}/end`),
      routeContext(driverConflictContractId),
    );
    expect(endCompetitorResponse.status).toBe(200);
    vehicleConflictContractId = await createActiveContract(
      vehicleAId,
      driverCId,
      `LC-${suffix}-C`,
    );
    const vehicleConflictResponse = await reopenContract(
      actionRequest(`http://localhost/api/contracts/${primaryContractId}/reopen`),
      routeContext(primaryContractId),
    );
    expect(vehicleConflictResponse.status).toBe(409);
    expect((await vehicleConflictResponse.json()).error).toContain("vehicle is already assigned");
    expect((await prisma.contract.findUniqueOrThrow({ where: { id: primaryContractId } })).status).toBe("Ended");
    expect((await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleAId } })).status).toBe("Rented");
  });
});
