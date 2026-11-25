import { expect, test } from "@playwright/test";

test("vehicle profile loads and persists quick updates", async ({ page, request }) => {
  const createResponse = await request.post("/api/vehicles", {
    data: {
      registration: `T${Date.now().toString().slice(-7)}`,
      model: "Browser Profile Test Vehicle",
      weeklyRent: 275,
      odometer: 12000,
      nextServiceKm: 13000,
    },
  });
  expect(createResponse.status()).toBe(201);
  const { vehicle } = (await createResponse.json()) as {
    vehicle: { id: string; registration: string };
  };

  try {
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
  } finally {
    const deleteResponse = await request.delete(`/api/vehicles/${vehicle.id}`);
    expect(deleteResponse.status()).toBe(204);
  }
});
