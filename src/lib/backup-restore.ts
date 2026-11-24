import { prisma } from "./db";
import { validateBackup, type BackupPayload } from "./backup-validation";
import { stageStoredFileRestore } from "./storage";

let restoreInProgress = false;

function date(value: string): Date {
  return new Date(value);
}

function nullableDate(value: string | null): Date | null {
  return value === null ? null : date(value);
}

export class BackupRestoreInProgressError extends Error {
  constructor() {
    super("A backup restore is already in progress.");
    this.name = "BackupRestoreInProgressError";
  }
}

export async function restoreBackup(input: unknown): Promise<void> {
  if (restoreInProgress) throw new BackupRestoreInProgressError();
  restoreInProgress = true;

  let stagedFiles: Awaited<ReturnType<typeof stageStoredFileRestore>> | undefined;
  try {
    const backup: BackupPayload = validateBackup(input);
    stagedFiles = await stageStoredFileRestore(
      backup.files.map((file) => ({
        storedName: file.storedName,
        data: Buffer.from(file.dataBase64, "base64"),
      })),
    );

    await prisma.$transaction(async (transaction) => {
      await transaction.document.deleteMany();
      await transaction.contract.deleteMany();
      await transaction.vehicleSwap.deleteMany();
      await transaction.vehicle.deleteMany();
      await transaction.driver.deleteMany();

      if (backup.records.vehicles.length > 0) {
        await transaction.vehicle.createMany({
          data: backup.records.vehicles.map((vehicle) => ({
            ...vehicle,
            registrationExpiry: nullableDate(vehicle.registrationExpiry),
            insuranceExpiry: nullableDate(vehicle.insuranceExpiry),
            inspectionExpiry: nullableDate(vehicle.inspectionExpiry),
            createdAt: date(vehicle.createdAt),
            updatedAt: date(vehicle.updatedAt),
          })),
        });
      }

      if (backup.records.drivers.length > 0) {
        await transaction.driver.createMany({
          data: backup.records.drivers.map((driver) => ({
            ...driver,
            dateOfBirth: nullableDate(driver.dateOfBirth),
            licenceExpiry: nullableDate(driver.licenceExpiry),
            rideshareAccreditationExpiry: nullableDate(driver.rideshareAccreditationExpiry),
            createdAt: date(driver.createdAt),
            updatedAt: date(driver.updatedAt),
          })),
        });
      }

      if (backup.records.vehicleSwaps.length > 0) {
        await transaction.vehicleSwap.createMany({
          data: backup.records.vehicleSwaps.map((swap) => ({
            ...swap,
            swapDate: date(swap.swapDate),
            createdAt: date(swap.createdAt),
          })),
        });
      }

      if (backup.records.contracts.length > 0) {
        await transaction.contract.createMany({
          data: backup.records.contracts.map((contract) => ({
            ...contract,
            agreementDate: nullableDate(contract.agreementDate),
            startDate: date(contract.startDate),
            endDate: nullableDate(contract.endDate),
            initialEndDate: nullableDate(contract.initialEndDate),
            endedAt: nullableDate(contract.endedAt),
            createdAt: date(contract.createdAt),
            updatedAt: date(contract.updatedAt),
          })),
        });
      }

      if (backup.records.documents.length > 0) {
        await transaction.document.createMany({
          data: backup.records.documents.map((document) => ({
            ...document,
            sizeBytes: BigInt(document.sizeBytes),
            expiryDate: nullableDate(document.expiryDate),
            createdAt: date(document.createdAt),
            updatedAt: date(document.updatedAt),
          })),
        });
      }

      await stagedFiles!.activate();
    });
  } catch (error) {
    if (stagedFiles) {
      try {
        await stagedFiles.rollback();
      } catch (rollbackError) {
        console.error("Motion Drive backup restore rollback failed", rollbackError);
        throw new Error("Backup restore failed and could not fully roll back.", {
          cause: error,
        });
      }
    }
    throw error;
  } finally {
    restoreInProgress = false;
  }

  try {
    await stagedFiles!.finalize();
  } catch (error) {
    console.error("Motion Drive backup restore cleanup failed", error);
  }
}
