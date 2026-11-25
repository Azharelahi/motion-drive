import { expect, test } from "@playwright/test";

test("vehicle register supports search, add, edit, cancel edit, and delete", async ({ page }) => {
  await page.goto("/vehicles");

  await expect(page.getByRole("heading", { name: "Vehicle Register" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Add vehicle" })).toBeVisible();

  const registration = `T${Date.now().toString().slice(-7)}`;
  await page.getByLabel("Registration *").fill(registration);
  await page.getByLabel("Model *").fill("Browser Test Vehicle");
  await page.getByLabel("Weekly rent").fill("275");
  await page.getByRole("button", { name: "Add vehicle" }).click();
  await expect(page.getByText("The vehicle was added to the register.")).toBeVisible();

  await page.getByRole("searchbox", { name: "Search" }).fill(registration);
  await expect(page.getByText(registration, { exact: true })).toBeVisible();

  const row = page.locator("tbody tr").filter({ hasText: registration });
  await row.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: "Edit vehicle" })).toBeVisible();
  await page.getByLabel("Colour").fill("Test Blue");
  await page.getByRole("button", { name: "Cancel Edit" }).click();
  await expect(page.getByRole("heading", { name: "Add vehicle" })).toBeVisible();

  await row.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Colour").fill("Test Blue");
  await page.getByRole("button", { name: "Save vehicle" }).click();
  await expect(page.getByText("The vehicle profile was saved.")).toBeVisible();

  await row.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Delete vehicle" }).click();
  await expect(page.getByText("The vehicle was removed from the register.")).toBeVisible();
});
