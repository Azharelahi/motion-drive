import { describe, expect, it } from "vitest";
import { extractPdfFields } from "../../src/lib/pdf-reader";

describe("extractPdfFields", () => {
  it("extracts vehicle registration, VIN, and Australian expiry dates", () => {
    expect(
      extractPdfFields(
        "Vehicle Registration: abc 123\nVIN: 1HGCM82633A004352\nRegistration expiry: 23/03/2027",
      ),
    ).toEqual({
      registration: "ABC123",
      vin: "1HGCM82633A004352",
      expiryDate: "2027-03-23",
    });
  });

  it("extracts driver licence number and accepts valid ISO dates", () => {
    expect(
      extractPdfFields("Driver Licence Number: vic-12345\nDate of expiry: 2027-03-23"),
    ).toEqual({
      licenceNumber: "VIC-12345",
      expiryDate: "2027-03-23",
    });
  });

  it("ignores invalid dates and returns no values for image-only text", () => {
    expect(extractPdfFields("Licence Number: ABC1234\nExpiry: 31/02/2027")).toEqual({
      licenceNumber: "ABC1234",
    });
    expect(extractPdfFields("")).toEqual({});
  });
});
