import { describe, expect, it } from "vitest";
import { getLicenceExpiryWarning } from "../../src/lib/driver-licence-warning";

describe("getLicenceExpiryWarning", () => {
  it("warns for missing and invalid expiry dates", () => {
    expect(getLicenceExpiryWarning(null, "2026-01-01")?.kind).toBe("missing");
    expect(getLicenceExpiryWarning("2026-02-30", "2026-01-01")?.kind).toBe("invalid");
    expect(getLicenceExpiryWarning("not-a-date", "2026-01-01")?.kind).toBe("invalid");
  });

  it("warns for expired licences and dates within the 90-day window", () => {
    expect(getLicenceExpiryWarning("2025-12-31", "2026-01-01")?.kind).toBe("expired");
    expect(getLicenceExpiryWarning("2026-01-01", "2026-01-01")).toMatchObject({
      kind: "soon",
      message: "Driver licence expires today.",
    });
    expect(getLicenceExpiryWarning("2026-04-01", "2026-01-01")?.kind).toBe("soon");
  });

  it("does not warn when expiry is more than 90 days away", () => {
    expect(getLicenceExpiryWarning("2026-04-02", "2026-01-01")).toBeNull();
  });

  it("accepts valid ISO date-time strings returned by Prisma JSON serialization", () => {
    expect(
      getLicenceExpiryWarning("2027-03-23T00:00:00.000Z", "2026-11-25"),
    ).toBeNull();
  });
});
