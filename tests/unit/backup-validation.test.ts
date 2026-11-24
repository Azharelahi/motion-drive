import { describe, expect, it } from "vitest";
import { BackupValidationError, validateBackup } from "../../src/lib/backup-validation";

const emptyBackup = {
  format: "MotionDrive_Backup",
  version: 1,
  exportedAt: "2026-11-24T10:00:00.000Z",
  records: {
    vehicles: [],
    drivers: [],
    contracts: [],
    vehicleSwaps: [],
    documents: [],
  },
  files: [],
};

describe("backup validation", () => {
  it("accepts a structurally valid empty backup", () => {
    expect(validateBackup(emptyBackup)).toEqual(emptyBackup);
  });

  it("rejects unknown fields and unsupported backup versions", () => {
    expect(() => validateBackup({ ...emptyBackup, version: 2 })).toThrow(BackupValidationError);
    expect(() => validateBackup({ ...emptyBackup, extra: true })).toThrow(BackupValidationError);
  });

  it("rejects invalid file data before restore can begin", () => {
    expect(() =>
      validateBackup({
        ...emptyBackup,
        files: [
          {
            storedName: "54735693-3616-428e-81c2-9cf348a96724.pdf",
            originalName: "agreement.pdf",
            mimeType: "application/pdf",
            sizeBytes: 3,
            modifiedAt: "2026-11-24T10:00:00.000Z",
            dataBase64: "%%%not-base64%%%",
          },
        ],
      }),
    ).toThrow("File data or size is invalid");
  });
});
