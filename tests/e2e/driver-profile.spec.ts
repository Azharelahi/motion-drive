import { expect, test } from "@playwright/test";

function melbourneDateOffset(days: number): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const date = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

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
  const warning = page.locator(".licence-warning");
  await expect(warning).toContainText("expiry date is missing");

  const cases: Array<{ expiry: string | null; warning: boolean; message?: string }> = [
    { expiry: "2026-02-30", warning: true, message: "expiry date is invalid" },
    { expiry: melbourneDateOffset(-1), warning: true, message: "has expired" },
    { expiry: melbourneDateOffset(90), warning: true, message: "expires in 90 days" },
    { expiry: melbourneDateOffset(91), warning: false },
  ];

  for (const testCase of cases) {
    expiryDate = testCase.expiry;
    await page.reload();
    if (testCase.warning) {
      await expect(warning).toContainText(testCase.message!);
    } else {
      await expect(warning).toHaveCount(0);
    }
  }
});
