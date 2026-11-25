import { expect, test, type Page, type Route } from "@playwright/test";

function createPdf(content: string): Buffer {
  const stream = content ? `BT /F1 12 Tf 72 720 Td (${content}) Tj ET` : "";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "ascii");
}

async function mockProfile(
  page: Page,
  documentName: string,
  onPatch?: (route: Route) => Promise<void>,
) {
  await page.route("**/api/drivers/test-driver", async (route: Route) => {
    if (route.request().method() === "PATCH") {
      if (onPatch) {
        await onPatch(route);
      } else {
        await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      }
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        driver: {
          id: "test-driver",
          name: "PDF Reader Test",
          mobile: "0400000000",
          email: null,
          dateOfBirth: null,
          address: null,
          licenceNumber: "OLD-1234",
          licenceState: "VIC",
          abn: null,
          emergencyContact: null,
          rideshareAccreditation: null,
          licenceExpiry: null,
          rideshareAccreditationExpiry: null,
          status: "Ended",
          notes: null,
          contracts: [],
          documents: [{
            id: "document-test",
            documentType: "Licence",
            originalName: documentName,
            expiryDate: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            sizeBytes: "100",
          }],
        },
      }),
    });
  });
}

test("Read & Update proposes text-PDF fields for confirmation", async ({ page }) => {
  const profileUpdates: Array<Record<string, string>> = [];
  const documentUpdates: Array<Record<string, string | null>> = [];
  await mockProfile(page, "licence.pdf", async (route) => {
    profileUpdates.push(route.request().postDataJSON() as Record<string, string>);
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route("**/api/documents/document-test/file", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      body: createPdf("Licence Number: VIC-12345 Expiry: 15/04/2028"),
    });
  });
  await page.route("**/api/documents/document-test", async (route) => {
    if (route.request().method() === "PATCH") {
      documentUpdates.push(route.request().postDataJSON() as Record<string, string | null>);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ document: { expiryDate: "2028-04-15T00:00:00.000Z" } }),
      });
      return;
    }
    await route.continue();
  });
  await page.goto("/drivers/test-driver");
  await page.getByRole("button", { name: "Read & Update" }).click();
  await expect(page.getByRole("dialog")).toContainText("Review the proposed values");
  await expect(page.getByLabel("Proposed Licence number")).toHaveValue("VIC-12345");
  await expect(page.getByLabel("Proposed Profile expiry date")).toHaveValue("2028-04-15");
  await page.getByRole("button", { name: "Apply selected updates" }).click();
  await expect(page.getByRole("status")).toContainText("Confirmed updates were applied.");
  expect(profileUpdates[0]).toMatchObject({
    licenceNumber: "VIC-12345",
    licenceExpiry: "2028-04-15",
  });
  expect(documentUpdates[0]).toEqual({ expiryDate: "2028-04-15" });
});

test("Read & Update prompts manual expiry for scanned PDFs", async ({ page }) => {
  let profileExpiry: string | undefined;
  await mockProfile(page, "scanned-licence.pdf", async (route) => {
    profileExpiry = (route.request().postDataJSON() as { licenceExpiry: string }).licenceExpiry;
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route("**/api/documents/document-test/file", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      body: createPdf(""),
    });
  });
  await page.route("**/api/documents/document-test", async (route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ document: { expiryDate: "2028-04-15T00:00:00.000Z" } }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/drivers/test-driver");
  await page.getByRole("button", { name: "Read & Update" }).click();
  await expect(page.getByRole("dialog")).toContainText("This PDF has no selectable text");
  await page.getByLabel("Manual profile expiry date").fill("2028-04-15");
  await page.getByRole("button", { name: "Apply selected updates" }).click();
  await expect(page.getByRole("status")).toContainText("Confirmed updates were applied.");
  expect(profileExpiry).toBe("2028-04-15");
});
