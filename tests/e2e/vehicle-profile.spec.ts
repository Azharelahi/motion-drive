import { expect, test } from "@playwright/test";

test("vehicle profile loads and persists quick updates", async ({ page, request }) => {
  const vehiclesResponse = await request.get("/api/vehicles");
  expect(vehiclesResponse.ok()).toBeTruthy();
  const vehiclesBody = (await vehiclesResponse.json()) as {
    vehicles: Array<{ id: string; registration: string }>;
  };
  const vehicle = vehiclesBody.vehicles[0];
  expect(vehicle).toBeTruthy();

  await page.goto(`/vehicles/${vehicle.id}`);
  await expect(page.getByRole("heading", { name: vehicle.registration })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vehicle information" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Quick Update" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();

  await page.getByLabel("Odometer").fill("54321");
  await page.getByLabel("Next service KM").fill("60000");
  await page.getByRole("button", { name: "Save quick update" }).click();
  await expect(page.getByText("Vehicle status and maintenance fields were updated.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Odometer")).toHaveValue("54321");
  await expect(page.getByLabel("Next service KM")).toHaveValue("60000");
});
