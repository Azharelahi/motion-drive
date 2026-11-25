import { expect, test } from "@playwright/test";

test("driver register supports search, add, edit, cancel edit, and delete", async ({ page }) => {
  await page.goto("/drivers");

  await expect(page.getByRole("heading", { name: "Driver Register" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Add driver" })).toBeVisible();

  const suffix = Date.now();
  const name = `Browser Test Driver ${suffix}`;
  const mobile = `0497${suffix.toString().slice(-6)}`;

  await page.getByLabel("Name *").fill(name);
  await page.getByLabel("Mobile *").fill(mobile);
  await page.getByLabel("Licence number").fill(`LIC-${suffix}`);
  await page.getByRole("button", { name: "Add driver" }).click();
  await expect(page.getByText("The driver was added to the register.")).toBeVisible();

  await page.getByRole("searchbox", { name: "Search" }).fill(name);
  await expect(page.getByText(name, { exact: true })).toBeVisible();

  const row = page.locator("tbody tr").filter({ hasText: name });
  await row.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: "Edit driver" })).toBeVisible();
  await page.getByLabel("Address").fill("Cancelled address");
  await page.getByRole("button", { name: "Cancel Edit" }).click();
  await expect(page.getByRole("heading", { name: "Add driver" })).toBeVisible();

  await row.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Address").fill("Browser Test Address");
  await page.getByRole("button", { name: "Save driver" }).click();
  await expect(page.getByText("The driver profile was saved.")).toBeVisible();

  await row.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Delete driver" }).click();
  await expect(page.getByText("The driver was removed from the register.")).toBeVisible();
});
