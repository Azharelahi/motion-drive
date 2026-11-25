import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/db";
import { GET as getDashboard } from "../../src/app/api/dashboard/route";

const suffix = Date.now().toString().slice(-9);
let vehicleId = "";
let driverId = "";
let contractId = "";
let documentId = "";

function melbourneDateOffset(days: number): Date {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const date = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

beforeAll(async () => {
  await prisma.$connect();
  const [vehicle, driver] = await prisma.$transaction([
    prisma.vehicle.create({
      data: {
        registration: `DB${suffix}`,
        model: "Dashboard Test Vehicle",
        status: "Rented",
        odometer: 12000,
        nextServiceKm: 12800,
        registrationExpiry: melbourneDateOffset(30),
        insuranceExpiry: melbourneDateOffset(100),
      },
    }),
    prisma.driver.create({
      data: {
        name: `Dashboard Test Driver ${suffix}`,
        mobile: `0430${suffix}`,
        status: "Current",
        licenceExpiry: melbourneDateOffset(60),
      },
    }),
  ]);
  vehicleId = vehicle.id;
  driverId = driver.id;
  const contract = await prisma.contract.create({
    data: {
      contractNumber: `DB-${suffix}`,
      vehicleId,
      driverId,
      status: "Active",
      startDate: melbourneDateOffset(0),
      weeklyRent: 275,
    },
  });
  contractId = contract.id;
  const document = await prisma.document.create({
    data: {
      entityType: "Driver",
      documentType: "Test Licence",
      originalName: `dashboard-test-${suffix}.pdf`,
      storedName: `dashboard-test-${suffix}.pdf`,
      storagePath: `dashboard-test/${suffix}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: BigInt(1),
      expiryDate: melbourneDateOffset(30),
      driverId,
    },
  });
  documentId = document.id;
});

afterAll(async () => {
  await prisma.$transaction(async (transaction) => {
    if (documentId) await transaction.document.deleteMany({ where: { id: documentId } });
    if (contractId) await transaction.contract.deleteMany({ where: { id: contractId } });
    if (vehicleId) await transaction.vehicle.deleteMany({ where: { id: vehicleId } });
    if (driverId) await transaction.driver.deleteMany({ where: { id: driverId } });
  });
  await prisma.$disconnect();
});

describe("dashboard API integration", () => {
  it("returns live counters, expiry registers, matching alerts, and at most eight recent contracts", async () => {
    const response = await getDashboard();
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      counters: {
        vehicles: number;
        drivers: number;
        savedContracts: number;
        activeRentals: number;
      };
      alerts: Array<{ id: string }>;
      vehicleExpiryRegister: Array<{
        id: string;
        registrationExpiry: { kind: string; daysRemaining: number | null };
        serviceDueInKm: number | null;
      }>;
      driverDocumentExpiryRegister: Array<{
        id: string;
        licenceExpiry: { kind: string; daysRemaining: number | null };
        documents: Array<{ id: string; expiryDate: { kind: string } }>;
      }>;
      recentContracts: Array<{ id: string; weeklyRent: string }>;
    };

    expect(body.counters.vehicles).toBeGreaterThanOrEqual(1);
    expect(body.counters.drivers).toBeGreaterThanOrEqual(1);
    expect(body.counters.savedContracts).toBeGreaterThanOrEqual(1);
    expect(body.counters.activeRentals).toBeGreaterThanOrEqual(1);
    expect(body.counters.activeRentals).toBeLessThanOrEqual(body.counters.savedContracts);
    expect(body.alerts.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        `driver-licence-${driverId}`,
        `vehicle-registrationExpiry-${vehicleId}`,
        `vehicle-service-${vehicleId}`,
        `document-${documentId}`,
      ]),
    );
    expect(body.vehicleExpiryRegister).toContainEqual(
      expect.objectContaining({
        id: vehicleId,
        registrationExpiry: expect.objectContaining({ kind: "due", daysRemaining: 30 }),
        serviceDueInKm: 800,
      }),
    );
    expect(body.driverDocumentExpiryRegister).toContainEqual(
      expect.objectContaining({
        id: driverId,
        licenceExpiry: expect.objectContaining({ kind: "due", daysRemaining: 60 }),
        documents: expect.arrayContaining([
          expect.objectContaining({
            id: documentId,
            expiryDate: expect.objectContaining({ kind: "due", daysRemaining: 30 }),
          }),
        ]),
      }),
    );
    expect(body.recentContracts.length).toBeLessThanOrEqual(8);
    expect(body.recentContracts).toContainEqual(
      expect.objectContaining({ id: contractId, weeklyRent: "275" }),
    );
  });
});
