import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RentalContractView from "@/components/RentalContractView";

describe("rental contract document", () => {
  it("renders all 13 Annexure A clauses, contract details, signatures, and print action", () => {
    const markup = renderToStaticMarkup(
      <RentalContractView
        contract={{
          contractNumber: "MD-2026-0012",
          status: "Active",
          agreementDate: new Date("2026-11-25T00:00:00.000Z"),
          startDate: new Date("2026-11-26T00:00:00.000Z"),
          endDate: null,
          weeklyRent: "325.00",
          bond: "650.00",
          excess: "1900.00",
          kmAllowance: "Unlimited",
          term: "Month to month",
          noticePeriod: "7 days",
          paymentFrequency: "Weekly in advance",
          paymentMethod: "PayID",
          rideshareUse: true,
          privateUse: false,
          driver: {
            name: "Test Driver",
            mobile: "0400000000",
            email: "driver@example.test",
            dateOfBirth: null,
            address: "Melbourne, VIC",
            licenceNumber: "D12345",
            licenceState: "VIC",
            licenceExpiry: null,
            rideshareAccreditation: null,
          },
          vehicle: {
            registration: "ABC123",
            make: "Toyota",
            model: "Corolla",
            year: 2024,
            colour: "White",
            vin: "TESTVIN123",
            pickupLocation: "Tarneit, VIC",
          },
        }}
      />,
    );

    expect(markup.match(/class="rental-contract-view__clause"/g)).toHaveLength(13);
    expect(markup).toContain("Governing law and disputes");
    expect(markup).toContain("laws of Victoria, Australia");
    expect(markup).toContain("Test Driver");
    expect(markup).toContain("ABC123");
    expect(markup).toContain("Driver signature");
    expect(markup).toContain("Print / Save as PDF");
  });
});
