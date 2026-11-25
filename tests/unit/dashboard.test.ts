import { describe, expect, it } from "vitest";
import { buildDashboardAlerts, getExpiryStatus } from "@/lib/dashboard";

const today = "2026-01-01";

describe("dashboard alert rules", () => {
  it("reports driver expiry, vehicle expiry, service, and expiring document alerts at their thresholds", () => {
    const alerts = buildDashboardAlerts(
      {
        currentDrivers: [
          {
            id: "missing-licence",
            name: "Missing Licence",
            licenceExpiry: null,
            rideshareAccreditationExpiry: null,
          },
          {
            id: "due-driver",
            name: "Due Driver",
            licenceExpiry: "2026-04-01",
            rideshareAccreditationExpiry: "2026-01-02",
          },
        ],
        vehicles: [
          {
            id: "due-vehicle",
            registration: "ABC123",
            registrationExpiry: "2026-01-01",
            insuranceExpiry: "2026-02-15",
            inspectionExpiry: "2026-03-01",
            odometer: 12000,
            nextServiceKm: 13000,
          },
        ],
        documents: [
          {
            id: "due-document",
            originalName: "licence.pdf",
            documentType: "Licence",
            expiryDate: "2026-03-02",
            driverId: "due-driver",
            vehicleId: null,
          },
        ],
      },
      today,
    );

    expect(alerts.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "driver-licence-missing-licence",
        "driver-licence-due-driver",
        "driver-rideshare-due-driver",
        "vehicle-registrationExpiry-due-vehicle",
        "vehicle-insuranceExpiry-due-vehicle",
        "vehicle-service-due-vehicle",
        "document-due-document",
      ]),
    );
    expect(alerts.find(({ id }) => id === "vehicle-service-due-vehicle")?.message).toContain("1,000 km");
  });

  it("returns no alerts when values are outside all warning windows", () => {
    expect(
      buildDashboardAlerts(
        {
          currentDrivers: [
            {
              id: "driver",
              name: "Current Driver",
              licenceExpiry: "2026-05-01",
              rideshareAccreditationExpiry: null,
            },
          ],
          vehicles: [
            {
              id: "vehicle",
              registration: "XYZ789",
              registrationExpiry: "2026-04-01",
              insuranceExpiry: null,
              inspectionExpiry: null,
              odometer: 10000,
              nextServiceKm: 12001,
            },
          ],
          documents: [
            {
              id: "document",
              originalName: "policy.pdf",
              documentType: "Insurance",
              expiryDate: "2026-03-03",
              driverId: null,
              vehicleId: "vehicle",
            },
          ],
        },
        today,
      ),
    ).toEqual([]);
  });

  it("classifies missing, invalid, expired, due, and valid register dates", () => {
    expect(getExpiryStatus(null, 45, today).kind).toBe("missing");
    expect(getExpiryStatus("2026-02-30", 45, today).kind).toBe("invalid");
    expect(getExpiryStatus("2025-12-31", 45, today)).toMatchObject({
      kind: "expired",
      daysRemaining: -1,
    });
    expect(getExpiryStatus("2026-02-15", 45, today)).toMatchObject({
      kind: "due",
      daysRemaining: 45,
    });
    expect(getExpiryStatus("2026-04-01", 45, today).kind).toBe("valid");
  });
});
