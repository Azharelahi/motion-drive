import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/db";
import { POST as uploadDocuments } from "../../src/app/api/documents/route";
import { DELETE as deleteDocument, PATCH as updateDocument } from "../../src/app/api/documents/[id]/route";
import { GET as getDocumentFile } from "../../src/app/api/documents/[id]/file/route";
import { deleteStoredFile } from "../../src/lib/storage";

const suffix = Date.now();
let driverId = "";
let documentIds: string[] = [];
let storedNames: string[] = [];

beforeAll(async () => {
  await prisma.$connect();
  const driver = await prisma.driver.create({
    data: {
      name: `Document API Test ${suffix}`,
      mobile: `0496${suffix.toString().slice(-6)}`,
      status: "Ended",
    },
  });
  driverId = driver.id;
});

afterAll(async () => {
  await prisma.$transaction(async (transaction) => {
    if (documentIds.length > 0) {
      await transaction.document.deleteMany({ where: { id: { in: documentIds } } });
    }
    if (driverId) {
      await transaction.driver.deleteMany({ where: { id: driverId } });
    }
  });
  for (const storedName of storedNames) await deleteStoredFile(storedName);
  await prisma.$disconnect();
});

describe("document API integration", () => {
  it("uploads multiple files, views/downloads, updates expiry, and deletes", async () => {
    const formData = new FormData();
    formData.set("entityType", "Driver");
    formData.set("entityId", driverId);
    formData.set("documentType", "Licence");
    formData.set("expiryDate", "2027-03-23");
    formData.append("files", new Blob(["licence data"], { type: "text/plain" }), "licence.txt");
    formData.append("files", new Blob(["supporting data"], { type: "text/plain" }), "support.txt");

    const uploadResponse = await uploadDocuments(
      new Request("http://localhost/api/documents", { method: "POST", body: formData }),
    );
    expect(uploadResponse.status).toBe(201);
    const uploaded = (await uploadResponse.json()) as {
      documents: Array<{
        id: string;
        storedName: string;
        entityType: string;
        documentType: string;
        expiryDate: string;
      }>;
    };
    expect(uploaded.documents).toHaveLength(2);
    documentIds = uploaded.documents.map((document) => document.id);
    storedNames = uploaded.documents.map((document) => document.storedName);
    expect(uploaded.documents[0]).toMatchObject({
      entityType: "Driver",
      documentType: "Licence",
    });

    const viewResponse = await getDocumentFile(
      new Request("http://localhost/api/documents/file"),
      { params: Promise.resolve({ id: documentIds[0] }) },
    );
    expect(viewResponse.status).toBe(200);
    expect(viewResponse.headers.get("content-disposition")).toContain("inline");
    expect(await viewResponse.text()).toBe("licence data");

    const downloadResponse = await getDocumentFile(
      new Request("http://localhost/api/documents/file?download=1"),
      { params: Promise.resolve({ id: documentIds[0] }) },
    );
    expect(downloadResponse.headers.get("content-disposition")).toContain("attachment");

    const patchResponse = await updateDocument(
      new Request(`http://localhost/api/documents/${documentIds[0]}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiryDate: "2028-04-15" }),
      }),
      { params: Promise.resolve({ id: documentIds[0] }) },
    );
    expect(patchResponse.status).toBe(200);
    const patchedBody = (await patchResponse.json()) as { document: { expiryDate: string } };
    expect(patchedBody.document.expiryDate).toContain("2028-04-15");

    const deleteResponse = await deleteDocument(
      new Request(`http://localhost/api/documents/${documentIds[0]}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: documentIds[0] }) },
    );
    expect(deleteResponse.status).toBe(204);
    documentIds = documentIds.slice(1);
    storedNames = storedNames.slice(1);
  });

  it("rejects a file that exceeds 25 MB and rejects invalid entity types", async () => {
    const oversizedForm = new FormData();
    oversizedForm.set("entityType", "Driver");
    oversizedForm.set("entityId", driverId);
    oversizedForm.set("documentType", "Licence");
    oversizedForm.append(
      "files",
      new Blob([new Uint8Array(25 * 1024 * 1024 + 1)], { type: "text/plain" }),
      "large.txt",
    );
    const oversizedResponse = await uploadDocuments(
      new Request("http://localhost/api/documents", { method: "POST", body: oversizedForm }),
    );
    expect(oversizedResponse.status).toBe(413);

    const invalidForm = new FormData();
    invalidForm.set("entityType", "driver");
    invalidForm.set("entityId", driverId);
    invalidForm.set("documentType", "Licence");
    invalidForm.append("files", new Blob(["x"], { type: "text/plain" }), "invalid.txt");
    const invalidResponse = await uploadDocuments(
      new Request("http://localhost/api/documents", { method: "POST", body: invalidForm }),
    );
    expect(invalidResponse.status).toBe(400);
  });
});
