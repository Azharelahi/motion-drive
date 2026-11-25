import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SwapAgreementView from "@/components/SwapAgreementView";

describe("vehicle swap agreement document", () => {
  it("renders the exchange, five agreed terms, notes, three signatures, and print action", () => {
    const markup = renderToStaticMarkup(
      <SwapAgreementView
        swap={{
          swapNumber: "MD-SWAP-2026-001",
          swapDate: new Date("2026-11-25T00:00:00.000Z"),
          notes: "Keys exchanged at the depot.",
          newRentOne: "375.00",
          newRentTwo: "425.00",
          driverOne: { name: "Driver One" },
          driverTwo: { name: "Driver Two" },
          vehicleOne: { registration: "ABC123", make: "Toyota", model: "Corolla" },
          vehicleTwo: { registration: "XYZ789", make: "Hyundai", model: "i30" },
        }}
      />,
    );

    expect(markup.match(/class="swap-agreement-view__term"/g)).toHaveLength(5);
    expect(markup).toContain("Driver One");
    expect(markup).toContain("Driver Two");
    expect(markup).toContain("ABC123");
    expect(markup).toContain("XYZ789");
    expect(markup).toContain("Keys exchanged at the depot.");
    expect(markup.match(/<i aria-hidden="true"><\/i>/g)).toHaveLength(3);
    expect(markup).toContain("Print Agreement");
  });
});
