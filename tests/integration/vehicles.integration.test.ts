import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/db";
import { POST as createVehicle } from "../../src/app/api/vehicles/route";
import {
  DELETE as deleteVehicle,
  PATCH as updateVehicle,
} from "../../src/app/api/vehicles/[id]/route";

const registration = `IT${Date.now().toString().slice(-10)}`.toUpperCase();
const driverName = `Vehicle API Test ${Date.now()}`;

let vehicleId = "";
let driverId = "";
let contractId = "";

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$transaction(async (transaction) => {
    if (contractId) {
      await transaction.contract.deleteMany({ where: { id: contractId } });
    }
    if (vehicleId) {
      await transaction.vehicle.deleteMany({ where: { id: vehicleId } });
    }
    if (driverId) {
      await transaction.driver.deleteMany({ where: { id: driverId } });
    }
  });
  await prisma.$disconnect();
});

describe("vehicle API integration", () => {
  it("creates with uppercase registration and defaults, edits, and blocks linked deletion", async () => {
    const createResponse = await createVehicle(
      new Request("http://localhost/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration: registration.toLowerCase(),
          model: "Integration Test",
          weeklyRent: 275,
        }),
      }),
    );
    expect(createResponse.status).toBe(201);

    const createdBody = await json(createResponse);
    const createdVehicle = createdBody.vehicle as {
      id: string;
      registration: string;
      bond: number | string;
      kmAllowance: string;
      pickupLocation: string;
    };
    vehicleId = createdVehicle.id;

    expect(createdVehicle.registration).toBe(registration);
    expect(createdVehicle.bond.toString()).toBe("500");
    expect(createdVehicle.kmAllowance).toBe("Unlimited");
    expect(createdVehicle.pickupLocation).toBe("Tarneit, VIC");

    const patchResponse = await updateVehicle(
      new Request(`http://localhost/api/vehicles/${vehicleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          odometer: 12345,
          nextServiceKm: 20000,
          status: "Available",
        }),
      }),
      { params: Promise.resolve({ id: vehicleId }) },
    );
    expect(patchResponse.status).toBe(200);

    const patchedBody = await json(patchResponse);
    const patchedVehicle = patchedBody.vehicle as {
      odometer: number;
      nextServiceKm: number;
      status: string;
    };
    expect(patchedVehicle).toMatchObject({
      odometer: 12345,
      nextServiceKm: 20000,
      status: "Available",
    });

    const driver = await prisma.driver.create({
      data: {
        name: driverName,
        mobile: `0499${Date.now().toString().slice(-6)}`,
        status: "Current",
      },
    });
    driverId = driver.id;

    const contract = await prisma.contract.create({
      data: {
        contractNumber: `IT-${Date.now()}`,
        vehicleId,
        driverId,
        status: "Active",
        startDate: new Date("2026-11-25T00:00:00.000Z"),
        weeklyRent: 275,
        bond: 500,
        excess: 2000,
        kmAllowance: "Unlimited",
      },
    });
    contractId = contract.id;

    const deleteResponse = await deleteVehicle(
      new Request(`http://localhost/api/vehicles/${vehicleId}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: vehicleId }) },
    );
    expect(deleteResponse.status).toBe(409);
    const deleteBody = await json(deleteResponse);
    expect(deleteBody.error).toContain("linked to one or more contracts");

    await prisma.contract.delete({ where: { id: contractId } });
    contractId = "";

    const unlinkedDeleteResponse = await deleteVehicle(
      new Request(`http://localhost/api/vehicles/${vehicleId}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: vehicleId }) },
    );
    expect(unlinkedDeleteResponse.status).toBe(204);
    vehicleId = "";
  });
});
