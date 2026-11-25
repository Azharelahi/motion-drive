import { expect, test } from "@playwright/test";

test("mobile shell stacks navigation and uses one-column grids", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  const shellColumns = await page.locator(".app-shell").evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns,
  );
  expect(shellColumns.trim().split(/\s+/)).toHaveLength(1);

  await page.locator(".app-main").evaluate((element) => {
    const grid = document.createElement("div");
    grid.className = "responsive-grid";
    grid.innerHTML = "<div>First</div><div>Second</div>";
    element.appendChild(grid);
  });

  const gridColumns = await page.locator(".responsive-grid").evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns,
  );
  expect(gridColumns.trim().split(/\s+/)).toHaveLength(1);
});

for (const agreementClass of ["rental-contract-view", "swap-agreement-view"]) {
  test(`print layout isolates ${agreementClass}`, async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await page.locator(".app-main").evaluate((element, className) => {
      const agreement = document.createElement("article");
      agreement.className = className;
      agreement.textContent =
        className === "rental-contract-view" ? "Rental Contract" : "Swap Agreement";
      element.appendChild(agreement);
    }, agreementClass);

    await page.emulateMedia({ media: "print" });

    await expect(page.locator(`.${agreementClass}`)).toBeVisible();
    await expect(page.locator(".app-sidebar")).toBeHidden();
    await expect(page.locator(".app-topbar")).toBeHidden();
  });
}
