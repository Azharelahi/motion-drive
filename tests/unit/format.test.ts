import { describe, expect, it } from "vitest";
import { daysUntil, formatAUD, formatDateAU } from "../../src/lib/format";

describe("formatAUD", () => {
  it("formats amounts with the Australian currency locale", () => {
    expect(formatAUD(1234.5)).toBe("$1,234.50");
    expect(formatAUD("500")).toBe("$500.00");
  });

  it("displays an em dash for missing or invalid values", () => {
    expect(formatAUD(null)).toBe("—");
    expect(formatAUD("not an amount")).toBe("—");
  });
});

describe("formatDateAU", () => {
  it("formats ISO dates and Date values as DD/MM/YYYY", () => {
    expect(formatDateAU("2026-11-24")).toBe("24/11/2026");
    expect(formatDateAU(new Date("2026-11-24T00:00:00.000Z"))).toBe("24/11/2026");
  });

  it("displays an em dash for missing or invalid dates", () => {
    expect(formatDateAU(undefined)).toBe("—");
    expect(formatDateAU("2026-02-30")).toBe("—");
    expect(formatDateAU("2026-02-30T12:00:00.000Z")).toBe("—");
    expect(formatDateAU("24/11/2026")).toBe("—");
  });
});

describe("daysUntil", () => {
  it("returns calendar days, including past and same-day dates", () => {
    expect(daysUntil("2026-11-30", "2026-11-24")).toBe(6);
    expect(daysUntil("2026-11-24", "2026-11-24")).toBe(0);
    expect(daysUntil("2026-11-20", "2026-11-24")).toBe(-4);
  });

  it("returns null when the target or reference date is missing or invalid", () => {
    expect(daysUntil(null, "2026-11-24")).toBeNull();
    expect(daysUntil("2026-02-30", "2026-11-24")).toBeNull();
    expect(daysUntil("2026-02-30T12:00:00.000Z", "2026-11-24")).toBeNull();
    expect(daysUntil("2026-11-30", "not a date")).toBeNull();
  });
});
