import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/db";
import { POST as createDriver } from "../../src/app/api/drivers/route";
import {
  DELETE as deleteDriver,
  PATCH as updateDriver,
} from "../../src/app/api/drivers/[id]/route";

const suffix = Date.now();
const uniqueName = `Driver API Test ${suffix}`;
const mobile = `0498${suffix.toString().slice(-6)}`;

let driverId = "";
let vehicleId = "";
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

describe("driver API integration", () => {
  it("creates, edits, blocks linked deletion, then deletes", async () => {
    const createResponse = await createDriver(
      new Request("http://localhost/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: uniqueName,
          mobile,
          licenceNumber: `LIC-${suffix}`,
          status: "Ended",
        }),
      }),
    );
    expect(createResponse.status).toBe(201);

    const createdBody = await json(createResponse);
    const createdDriver = createdBody.driver as {
      id: string;
      name: string;
      mobile: string;
      status: string;
    };
    driverId = createdDriver.id;
    expect(createdDriver).toMatchObject({
      name: uniqueName,
      mobile,
      status: "Ended",
    });

    const patchResponse = await updateDriver(
      new Request(`http://localhost/api/drivers/${driverId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Current",
          licenceExpiry: "2027-11-25",
          address: "Test Address",
        }),
      }),
      { params: Promise.resolve({ id: driverId }) },
    );
    expect(patchResponse.status).toBe(200);
    const patchedBody = await json(patchResponse);
    const patchedDriver = patchedBody.driver as {
      status: string;
      address: string;
    };
    expect(patchedDriver.status).toBe("Current");
    expect(patchedDriver.address).toBe("Test Address");

    const vehicle = await prisma.vehicle.create({
      data: {
        registration: `DR${suffix.toString().slice(-12)}`.toUpperCase(),
        model: "Driver API Test Vehicle",
        status: "Rented",
        weeklyRent: 275,
        bond: 500,
      },
    });
    vehicleId = vehicle.id;

    const contract = await prisma.contract.create({
      data: {
        contractNumber: `DR-IT-${suffix}`,
        vehicleId,
        driverId,
        status: "Active",
        startDate: new Date("2026-11-25T00:00:00.000Z"),
        weeklyRent: 275,
        bond: 500,
      },
    });
    contractId = contract.id;

    const blockedResponse = await deleteDriver(
      new Request(`http://localhost/api/drivers/${driverId}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: driverId }) },
    );
    expect(blockedResponse.status).toBe(409);
    const blockedBody = await json(blockedResponse);
    expect(blockedBody.error).toContain("linked to one or more contracts");

    await prisma.contract.delete({ where: { id: contractId } });
    contractId = "";

    const deleteResponse = await deleteDriver(
      new Request(`http://localhost/api/drivers/${driverId}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: driverId }) },
    );
    expect(deleteResponse.status).toBe(204);
    driverId = "";

    await prisma.vehicle.delete({ where: { id: vehicleId } });
    vehicleId = "";
  });
});
