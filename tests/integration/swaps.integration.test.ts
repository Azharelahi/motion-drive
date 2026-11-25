import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/db";
import { POST as createSwap } from "../../src/app/api/swaps/route";

const suffix = Date.now().toString().slice(-9);
const swapDate = "2026-11-25";
const originalEndDate = new Date("2026-12-31T00:00:00.000Z");
let vehicleOneId = "";
let vehicleTwoId = "";
let driverOneId = "";
let driverTwoId = "";

function swapRequest(payload: Record<string, unknown>) {
  return new Request("http://localhost/api/swaps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function validSwapPayload() {
  return {
    swapDate,
    driverOneId,
    driverTwoId,
    vehicleOneId,
    vehicleTwoId,
    newRentOne: 375,
    newRentTwo: 425,
    notes: "Integration test car exchange",
  };
}

beforeAll(async () => {
  await prisma.$connect();
  const [vehicleOne, vehicleTwo, driverOne, driverTwo] = await prisma.$transaction([
    prisma.vehicle.create({
      data: {
        registration: `SI${suffix}A`,
        model: "Swap Integration Vehicle A",
        weeklyRent: 275,
        bond: 550,
        excess: 1600,
        kmAllowance: "Unlimited",
        status: "Rented",
      },
    }),
    prisma.vehicle.create({
      data: {
        registration: `SI${suffix}B`,
        model: "Swap Integration Vehicle B",
        weeklyRent: 325,
        bond: 650,
        excess: 1900,
        kmAllowance: "2000 km/week",
        status: "Rented",
      },
    }),
    prisma.driver.create({
      data: {
        name: `Swap Integration Driver One ${suffix}`,
        mobile: `0497${suffix}`,
        status: "Current",
      },
    }),
    prisma.driver.create({
      data: {
        name: `Swap Integration Driver Two ${suffix}`,
        mobile: `0496${suffix}`,
        status: "Current",
      },
    }),
  ]);
  vehicleOneId = vehicleOne.id;
  vehicleTwoId = vehicleTwo.id;
  driverOneId = driverOne.id;
  driverTwoId = driverTwo.id;

  await prisma.$transaction([
    prisma.contract.create({
      data: {
        contractNumber: `SI-${suffix}-A`,
        vehicleId: vehicleOneId,
        driverId: driverOneId,
        status: "Active",
        startDate: new Date("2026-11-01T00:00:00.000Z"),
        endDate: originalEndDate,
        initialEndDate: originalEndDate,
        weeklyRent: 275,
        term: "Month to month",
        noticePeriod: "7 days",
        paymentFrequency: "Weekly in advance",
        paymentMethod: "Bank Transfer",
        rideshareUse: true,
        privateUse: false,
      },
    }),
    prisma.contract.create({
      data: {
        contractNumber: `SI-${suffix}-B`,
        vehicleId: vehicleTwoId,
        driverId: driverTwoId,
        status: "Active",
        startDate: new Date("2026-11-01T00:00:00.000Z"),
        endDate: originalEndDate,
        initialEndDate: originalEndDate,
        weeklyRent: 325,
        term: "Fixed term",
        noticePeriod: "14 days",
        paymentFrequency: "Weekly in advance",
        paymentMethod: "PayID",
        rideshareUse: false,
        privateUse: true,
      },
    }),
  ]);
});

afterAll(async () => {
  await prisma.$transaction(async (transaction) => {
    const vehicleIds = [vehicleOneId, vehicleTwoId].filter(Boolean);
    const driverIds = [driverOneId, driverTwoId].filter(Boolean);
    if (vehicleIds.length || driverIds.length) {
      await transaction.contract.deleteMany({
        where: {
          OR: [
            ...(vehicleIds.length ? [{ vehicleId: { in: vehicleIds } }] : []),
            ...(driverIds.length ? [{ driverId: { in: driverIds } }] : []),
          ],
        },
      });
      await transaction.vehicleSwap.deleteMany({
        where: {
          OR: [
            ...(driverIds.length ? [{ driverOneId: { in: driverIds } }] : []),
            ...(driverIds.length ? [{ driverTwoId: { in: driverIds } }] : []),
          ],
        },
      });
    }
    if (vehicleIds.length) {
      await transaction.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
    }
    if (driverIds.length) {
      await transaction.driver.deleteMany({ where: { id: { in: driverIds } } });
    }
  });
  await prisma.$disconnect();
});

describe("vehicle swap API integration", () => {
  it("validates swap participants and atomically exchanges their active vehicles", async () => {
    const duplicateDriverResponse = await createSwap(
      swapRequest({ ...validSwapPayload(), driverTwoId: driverOneId }),
    );
    expect(duplicateDriverResponse.status).toBe(400);

    const duplicateVehicleResponse = await createSwap(
      swapRequest({ ...validSwapPayload(), vehicleTwoId: vehicleOneId }),
    );
    expect(duplicateVehicleResponse.status).toBe(400);

    const mismatchedVehicleResponse = await createSwap(
      swapRequest({
        ...validSwapPayload(),
        vehicleOneId: vehicleTwoId,
        vehicleTwoId: vehicleOneId,
      }),
    );
    expect(mismatchedVehicleResponse.status).toBe(409);

    const invalidSwapDateResponse = await createSwap(
      swapRequest({ ...validSwapPayload(), swapDate: "2026-10-31" }),
    );
    expect(invalidSwapDateResponse.status).toBe(400);

    const [oldContractsBeforeSwap, vehiclesBeforeSwap, driversBeforeSwap, swapsBeforeSwap] =
      await Promise.all([
        prisma.contract.findMany({
          where: { vehicleId: { in: [vehicleOneId, vehicleTwoId] } },
          orderBy: { contractNumber: "asc" },
        }),
        prisma.vehicle.findMany({ where: { id: { in: [vehicleOneId, vehicleTwoId] } } }),
        prisma.driver.findMany({ where: { id: { in: [driverOneId, driverTwoId] } } }),
        prisma.vehicleSwap.count({
          where: { OR: [{ driverOneId }, { driverTwoId }] },
        }),
      ]);
    expect(oldContractsBeforeSwap).toHaveLength(2);
    expect(oldContractsBeforeSwap.every((contract) => contract.status === "Active")).toBe(true);
    expect(vehiclesBeforeSwap.every((vehicle) => vehicle.status === "Rented")).toBe(true);
    expect(driversBeforeSwap.every((driver) => driver.status === "Current")).toBe(true);
    expect(swapsBeforeSwap).toBe(0);

    const concurrentResponses = await Promise.all([
      createSwap(swapRequest(validSwapPayload())),
      createSwap(swapRequest(validSwapPayload())),
    ]);
    expect(concurrentResponses.map((response) => response.status).sort()).toEqual([201, 409]);

    const successResponse = concurrentResponses.find((response) => response.status === 201);
    expect(successResponse).toBeDefined();
    const body = (await successResponse!.json()) as {
      swap: { id: string; swapNumber: string; swapDate: string; notes: string | null };
      endedContractIds: string[];
      contracts: Array<{
        id: string;
        contractNumber: string;
        driverId: string;
        vehicleId: string;
        weeklyRent: string;
        status: string;
        swapLeg: string;
        vehicle: { registration: string };
      }>;
    };
    const { swap, contracts, endedContractIds } = body;
    expect(swap.swapNumber).toMatch(/^MD-SWAP-\d{4}-\d{3,}$/);
    expect(swap.swapDate.slice(0, 10)).toBe(swapDate);
    expect(swap.notes).toBe("Integration test car exchange");
    expect(endedContractIds).toHaveLength(2);
    expect(contracts).toHaveLength(2);
    expect(contracts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contractNumber: `${swap.swapNumber}-A`,
          driverId: driverOneId,
          vehicleId: vehicleTwoId,
          weeklyRent: "375",
          status: "Active",
          swapLeg: "A",
        }),
        expect.objectContaining({
          contractNumber: `${swap.swapNumber}-B`,
          driverId: driverTwoId,
          vehicleId: vehicleOneId,
          weeklyRent: "425",
          status: "Active",
          swapLeg: "B",
        }),
      ]),
    );

    const [oldContracts, swapRecord, activeContracts, vehicles, drivers] = await Promise.all([
      prisma.contract.findMany({ where: { id: { in: endedContractIds } } }),
      prisma.vehicleSwap.findUniqueOrThrow({ where: { id: swap.id } }),
      prisma.contract.findMany({
        where: { driverId: { in: [driverOneId, driverTwoId] }, status: "Active" },
      }),
      prisma.vehicle.findMany({ where: { id: { in: [vehicleOneId, vehicleTwoId] } } }),
      prisma.driver.findMany({ where: { id: { in: [driverOneId, driverTwoId] } } }),
    ]);
    expect(oldContracts).toHaveLength(2);
    expect(oldContracts.every((contract) => contract.status === "Ended")).toBe(true);
    expect(oldContracts.every((contract) => contract.endDate?.toISOString().slice(0, 10) === swapDate)).toBe(true);
    expect(oldContracts.every((contract) => contract.initialEndDate?.toISOString().slice(0, 10) === "2026-12-31")).toBe(true);
    expect(swapRecord.swapNumber).toBe(swap.swapNumber);
    expect(activeContracts).toHaveLength(2);
    expect(activeContracts.every((contract) => contract.swapId === swapRecord.id)).toBe(true);
    expect(vehicles.every((vehicle) => vehicle.status === "Rented")).toBe(true);
    expect(drivers.every((driver) => driver.status === "Current")).toBe(true);
  });
});
