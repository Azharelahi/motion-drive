import { describe, expect, it } from "vitest";
import { findDuplicateActiveContractIds } from "../../src/lib/sync";

describe("duplicate active rental sync", () => {
  it("keeps the latest active contract for a vehicle and ends older duplicates", () => {
    const contracts = [
      {
        id: "old",
        vehicleId: "vehicle-1",
        driverId: "driver-1",
        status: "Active",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        startDate: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        id: "new",
        vehicleId: "vehicle-1",
        driverId: "driver-1",
        status: "Active",
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
        startDate: new Date("2026-02-01T00:00:00.000Z"),
      },
    ];

    expect(findDuplicateActiveContractIds(contracts)).toEqual(["old"]);
  });

  it("ignores ended contracts and handles different vehicles", () => {
    const contracts = [
      {
        id: "ended",
        vehicleId: "vehicle-1",
        driverId: "driver-1",
        status: "Ended",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        startDate: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        id: "active",
        vehicleId: "vehicle-2",
        driverId: "driver-2",
        status: "Active",
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
        startDate: new Date("2026-02-01T00:00:00.000Z"),
      },
    ];

    expect(findDuplicateActiveContractIds(contracts)).toEqual([]);
  });
});
