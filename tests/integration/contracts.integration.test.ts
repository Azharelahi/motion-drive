import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/db";
import { POST as createContract } from "../../src/app/api/contracts/route";

const suffix = Date.now();
let vehicleId = "";
let driverId = "";
let secondDriverId = "";
let contractId = "";

beforeAll(async () => {
  await prisma.$connect();
  const [vehicle, driver, secondDriver] = await prisma.$transaction([
    prisma.vehicle.create({
      data: {
        registration: `CR${suffix.toString().slice(-12)}`.toUpperCase(),
        model: "Contract API Test Vehicle",
        weeklyRent: 310,
        bond: 600,
        excess: 1800,
        kmAllowance: "Unlimited",
        status: "Available",
      },
    }),
    prisma.driver.create({
      data: {
        name: `Contract API Test Driver ${suffix}`,
        mobile: `0495${suffix.toString().slice(-6)}`,
        status: "Ended",
      },
    }),
    prisma.driver.create({
      data: {
        name: `Contract API Second Driver ${suffix}`,
        mobile: `0494${suffix.toString().slice(-6)}`,
        status: "Ended",
      },
    }),
  ]);
  vehicleId = vehicle.id;
  driverId = driver.id;
  secondDriverId = secondDriver.id;
});

afterAll(async () => {
  await prisma.$transaction(async (transaction) => {
    if (contractId) await transaction.contract.deleteMany({ where: { id: contractId } });
    if (vehicleId) await transaction.vehicle.deleteMany({ where: { id: vehicleId } });
    if (driverId) await transaction.driver.deleteMany({ where: { id: driverId } });
    if (secondDriverId) await transaction.driver.deleteMany({ where: { id: secondDriverId } });
  });
  await prisma.$disconnect();
});

describe("contract creation integration", () => {
  it("creates an active contract atomically and prevents a duplicate active rental", async () => {
    const payload = {
      vehicleId,
      driverId,
      agreementDate: "2026-11-25",
      startDate: "2026-11-26",
      endDate: "2026-12-26",
      weeklyRent: 325,
      bond: 650,
      excess: 1900,
      kmAllowance: "Unlimited",
      term: "Month to month",
      noticePeriod: "7 days",
      paymentFrequency: "Weekly in advance",
      paymentMethod: "PayID",
      rideshareUse: true,
      privateUse: false,
    };

    const response = await createContract(
      new Request("http://localhost/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      contract: {
        id: string;
        contractNumber: string;
        status: string;
        paymentMethod: string;
        rideshareUse: boolean;
        privateUse: boolean;
      };
    };
    contractId = body.contract.id;
    expect(body.contract.contractNumber).toMatch(/^MD-\d{4}-\d{4,}$/);
    expect(body.contract).toMatchObject({
      status: "Active",
      paymentMethod: "PayID",
      rideshareUse: true,
      privateUse: false,
    });

    const [vehicle, driver] = await Promise.all([
      prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId } }),
      prisma.driver.findUniqueOrThrow({ where: { id: driverId } }),
    ]);
    expect(vehicle.status).toBe("Rented");
    expect(driver.status).toBe("Current");

    const duplicateResponse = await createContract(
      new Request("http://localhost/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, driverId: secondDriverId }),
      }),
    );
    expect(duplicateResponse.status).toBe(409);

    const unchangedDriver = await prisma.driver.findUniqueOrThrow({
      where: { id: secondDriverId },
    });
    expect(unchangedDriver.status).toBe("Ended");
  });
});
