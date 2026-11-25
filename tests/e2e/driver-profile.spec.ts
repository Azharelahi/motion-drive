import { expect, test } from "@playwright/test";

test("driver profile displays licence warnings for all required expiry cases", async ({ page }) => {
  let expiryDate: string | null = null;
  await page.route("**/api/drivers/test-driver", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        driver: {
          id: "test-driver",
          name: "Licence Warning Test",
          mobile: "0400000000",
          email: null,
          dateOfBirth: null,
          address: null,
          licenceNumber: "LIC-TEST",
          licenceState: "VIC",
          abn: null,
          emergencyContact: null,
          rideshareAccreditation: null,
          licenceExpiry: expiryDate,
          rideshareAccreditationExpiry: null,
          status: "Ended",
          notes: null,
          contracts: [],
          documents: [],
        },
      }),
    });
  });

  await page.goto("/drivers/test-driver");
  await expect(page.getByRole("heading", { name: "Licence Warning Test" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("expiry date is missing");

  const cases: Array<{ expiry: string | null; warning: boolean; message?: string }> = [
    { expiry: "2026-02-30", warning: true, message: "expiry date is invalid" },
    { expiry: "2025-12-31", warning: true, message: "has expired" },
    { expiry: "2026-04-01", warning: true, message: "expires in 90 days" },
    { expiry: "2026-04-02", warning: false },
  ];

  for (const testCase of cases) {
    expiryDate = testCase.expiry;
    await page.reload();
    const warning = page.getByRole("alert");
    if (testCase.warning) {
      await expect(warning).toContainText(testCase.message!);
    } else {
      await expect(warning).toHaveCount(0);
    }
  }
});
