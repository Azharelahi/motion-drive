import { describe, expect, it } from "vitest";
import { filterContracts, type ContractSearchFields } from "@/lib/contracts";

const contracts: Array<ContractSearchFields & { id: string }> = [
  {
    id: "one",
    contractNumber: "MD-2026-0001",
    driver: { name: "Alex Driver", mobile: "0400123456" },
    vehicle: { registration: "ABC123", make: "Toyota", model: "Corolla" },
  },
  {
    id: "two",
    contractNumber: "MD-2026-0002",
    driver: { name: "Taylor Driver", mobile: "0400654321" },
    vehicle: { registration: "XYZ789", make: "Hyundai", model: "i30" },
  },
];

describe("saved contract search", () => {
  it("matches contract number, driver, mobile, registration, and vehicle model case-insensitively", () => {
    for (const query of ["md-2026-0001", "alex", "0400123456", "abc123", "corolla"]) {
      expect(filterContracts(contracts, query).map(({ id }) => id)).toEqual(["one"]);
    }
  });

  it("returns all contracts for an empty query and none for an unmatched query", () => {
    expect(filterContracts(contracts, "  ")).toHaveLength(2);
    expect(filterContracts(contracts, "no match")).toEqual([]);
  });
});
