import { describe, expect, it } from "vitest";
import {
  deleteStoredFile,
  getStoredFileMimeType,
  listStoredFiles,
  MAX_UPLOAD_BYTES,
  readStoredFile,
  saveUpload,
  StorageValidationError,
} from "../../src/lib/storage";

describe("local upload storage", () => {
  it("saves, lists, reads, and deletes an allowed file", async () => {
    const data = Buffer.from("Motion Drive sample document", "utf8");
    const upload = await saveUpload({
      originalName: "sample.txt",
      mimeType: "text/plain; charset=utf-8",
      data,
    });

    try {
      expect(upload.originalName).toBe("sample.txt");
      expect(upload.mimeType).toBe("text/plain");
      expect(getStoredFileMimeType(upload.storedName)).toBe("text/plain");
      expect(upload.sizeBytes).toBe(data.byteLength);
      expect(upload.storagePath).toMatch(/^storage\/uploads\//);
      expect(upload.storedName).toMatch(/^[0-9a-f-]+\.txt$/i);

      const listedFiles = await listStoredFiles();
      expect(listedFiles.some((file) => file.storedName === upload.storedName)).toBe(true);
      expect(await readStoredFile(upload.storedName)).toEqual(data);
      expect(await deleteStoredFile(upload.storedName)).toBe(true);
      expect(await deleteStoredFile(upload.storedName)).toBe(false);
    } finally {
      await deleteStoredFile(upload.storedName);
    }
  });

  it("rejects files larger than 25 MB", async () => {
    await expect(
      saveUpload({
        originalName: "large.pdf",
        mimeType: "application/pdf",
        data: new Uint8Array(MAX_UPLOAD_BYTES + 1),
      }),
    ).rejects.toBeInstanceOf(StorageValidationError);
  });

  it("rejects disallowed extensions and mismatched MIME types", async () => {
    await expect(
      saveUpload({
        originalName: "program.exe",
        mimeType: "application/octet-stream",
        data: Buffer.from("no"),
      }),
    ).rejects.toThrow("This file type is not allowed.");

    await expect(
      saveUpload({
        originalName: "note.txt",
        mimeType: "application/pdf",
        data: Buffer.from("no"),
      }),
    ).rejects.toThrow("The file name and file type do not match.");
  });

  it("rejects paths supplied instead of a generated stored name", async () => {
    await expect(readStoredFile("../outside.txt")).rejects.toBeInstanceOf(StorageValidationError);
    await expect(deleteStoredFile("../outside.txt")).rejects.toBeInstanceOf(StorageValidationError);
    expect(() => getStoredFileMimeType("../outside.txt")).toThrow(StorageValidationError);
  });
});
