import { Prisma } from "@prisma/client";
import {
  deleteStoredFile,
  readStoredFile,
  saveUpload,
  type StoredUpload,
} from "../src/lib/storage";
import { isMoziDriverName, seedData, signedAgreementPdfs } from "../src/lib/seed-data";
import { prisma } from "../src/lib/db";

function dateOnly(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function dateTime(value: string | null): Date | undefined {
  return value ? new Date(value) : undefined;
}

async function storeSignedAgreements(): Promise<{
  byKey: Map<string, StoredUpload>;
  newlyStoredNames: string[];
}> {
  const seedDocumentIds = seedData.documents.map((document) => document.id);
  const existingDocuments = await prisma.document.findMany({
    where: { id: { in: seedDocumentIds } },
    select: { id: true, storedName: true },
  });
  const existingNameByDocumentId = new Map(
    existingDocuments.map((document) => [document.id, document.storedName]),
  );
  const byKey = new Map<string, StoredUpload>();
  const newlyStoredNames: string[] = [];

  for (const agreement of signedAgreementPdfs) {
    const linkedDocumentIds = seedData.documents
      .filter((document) => document.embeddedKey === agreement.embeddedKey)
      .map((document) => document.id);
    let existingStoredName: string | undefined;

    for (const documentId of linkedDocumentIds) {
      const candidate = existingNameByDocumentId.get(documentId);
      if (!candidate) continue;

      try {
        const content = await readStoredFile(candidate);
        if (content.subarray(0, 5).toString("ascii") === "%PDF-") {
          existingStoredName = candidate;
          break;
        }
      } catch {
        // Restore the embedded seed copy when a prior file is missing or unreadable.
      }
    }

    if (existingStoredName) {
      byKey.set(agreement.embeddedKey, {
        storedName: existingStoredName,
        originalName: agreement.fileName,
        mimeType: agreement.mimeType,
        sizeBytes: Buffer.from(agreement.base64, "base64").byteLength,
        storagePath: `storage/uploads/${existingStoredName}`,
      });
      continue;
    }

    const stored = await saveUpload({
      originalName: agreement.fileName,
      mimeType: agreement.mimeType,
      data: Buffer.from(agreement.base64, "base64"),
    });
    byKey.set(agreement.embeddedKey, stored);
    newlyStoredNames.push(stored.storedName);
  }

  return { byKey, newlyStoredNames };
}

async function removeMoziDrivers(): Promise<void> {
  const existingDrivers = await prisma.driver.findMany({ select: { id: true, name: true } });
  const ids = existingDrivers.filter((driver) => isMoziDriverName(driver.name)).map((driver) => driver.id);
  if (ids.length === 0) return;

  await prisma.$transaction(async (transaction) => {
    await transaction.contract.deleteMany({ where: { driverId: { in: ids } } });
    await transaction.document.deleteMany({ where: { driverId: { in: ids } } });
    await transaction.driver.deleteMany({ where: { id: { in: ids } } });
  });
}

async function main(): Promise<void> {
  await removeMoziDrivers();

  const vehicles = seedData.vehicles;
  const drivers = seedData.drivers.filter((driver) => !isMoziDriverName(driver.name));
  const driverIds = new Set(drivers.map((driver) => driver.id));
  const contracts = seedData.contracts.filter((contract) => driverIds.has(contract.driverId));
  const documents = seedData.documents.filter(
    (document) => document.entityType !== "Driver" || driverIds.has(document.ownerId),
  );

  const { byKey: signedFiles, newlyStoredNames } = await storeSignedAgreements();

  try {
    await prisma.$transaction(async (transaction) => {
      for (const vehicle of vehicles) {
        const data = {
          registration: vehicle.registration,
          make: vehicle.make,
          model: vehicle.model,
          fuelType: vehicle.fuelType,
          year: vehicle.year,
          colour: vehicle.colour,
          vin: vehicle.vin,
          status: vehicle.status,
          weeklyRent: new Prisma.Decimal(vehicle.weeklyRent),
          bond: new Prisma.Decimal(vehicle.bond),
          excess: new Prisma.Decimal(vehicle.excess),
          kmAllowance: vehicle.kmAllowance,
          pickupLocation: vehicle.pickupLocation,
          odometer: vehicle.odometer,
          nextServiceKm: vehicle.nextServiceKm,
          registrationExpiry: dateOnly(vehicle.registrationExpiry),
          insuranceExpiry: dateOnly(vehicle.insuranceExpiry),
          inspectionExpiry: dateOnly(vehicle.inspectionExpiry),
          notes: vehicle.notes,
        };

        await transaction.vehicle.upsert({
          where: { id: vehicle.id },
          create: { id: vehicle.id, ...data },
          update: {},
        });
      }

      for (const driver of drivers) {
        const data = {
          name: driver.name,
          mobile: driver.mobile,
          email: driver.email,
          dateOfBirth: dateOnly(driver.dateOfBirth),
          address: driver.address,
          licenceNumber: driver.licenceNumber,
          licenceState: driver.licenceState,
          abn: driver.abn,
          emergencyContact: driver.emergencyContact,
          rideshareAccreditation: driver.rideshareAccreditation,
          licenceExpiry: dateOnly(driver.licenceExpiry),
          rideshareAccreditationExpiry: dateOnly(driver.rideshareAccreditationExpiry),
          status: driver.status,
          notes: driver.notes,
        };

        await transaction.driver.upsert({
          where: { id: driver.id },
          create: { id: driver.id, ...data },
          update: {},
        });
      }

      for (const contract of contracts) {
        const data = {
          contractNumber: contract.contractNumber,
          vehicleId: contract.vehicleId,
          driverId: contract.driverId,
          status: contract.status,
          agreementDate: dateOnly(contract.agreementDate),
          startDate: dateOnly(contract.startDate)!,
          endDate: dateOnly(contract.endDate),
          initialEndDate: dateOnly(contract.initialEndDate),
          weeklyRent: new Prisma.Decimal(contract.weeklyRent),
          bond: new Prisma.Decimal(contract.bond),
          excess: new Prisma.Decimal(contract.excess),
          kmAllowance: contract.kmAllowance,
          term: contract.term,
          noticePeriod: contract.noticePeriod,
          paymentFrequency: contract.paymentFrequency,
          paymentMethod: contract.paymentMethod,
          rideshareUse: contract.rideshareUse,
          privateUse: contract.privateUse,
          createdAt: dateTime(contract.createdAt),
        };

        await transaction.contract.upsert({
          where: { id: contract.id },
          create: { id: contract.id, ...data },
          update: {},
        });
      }

      for (const document of documents) {
        const storedFile = signedFiles.get(document.embeddedKey);
        if (!storedFile) {
          throw new Error(`Missing embedded agreement ${document.embeddedKey}.`);
        }

        const data = {
          entityType: document.entityType,
          documentType: document.documentType,
          originalName: document.originalName,
          storedName: storedFile.storedName,
          storagePath: storedFile.storagePath,
          mimeType: storedFile.mimeType,
          sizeBytes: BigInt(storedFile.sizeBytes),
          expiryDate: null,
          createdAt: dateTime(document.createdAt),
          vehicleId: document.entityType === "Vehicle" ? document.ownerId : null,
          driverId: document.entityType === "Driver" ? document.ownerId : null,
        };

        await transaction.document.upsert({
          where: { id: document.id },
          create: { id: document.id, ...data },
          update: {},
        });
      }
    });
  } catch (error) {
    await Promise.all(newlyStoredNames.map((storedName) => deleteStoredFile(storedName)));
    throw error;
  }

  const [vehicleCount, driverCount, contractCount, documentCount, moziCount] = await Promise.all([
    prisma.vehicle.count(),
    prisma.driver.count(),
    prisma.contract.count(),
    prisma.document.count(),
    prisma.driver.count({ where: { name: { contains: "Mozi", mode: "insensitive" } } }),
  ]);

  console.info("Motion Drive seed complete", {
    seededVehicles: vehicles.length,
    seededDrivers: drivers.length,
    seededContracts: contracts.length,
    seededDocumentLinks: documents.length,
    embeddedAgreementPdfs: signedFiles.size,
    databaseCounts: { vehicles: vehicleCount, drivers: driverCount, contracts: contractCount, documents: documentCount },
    moziDriverCount: moziCount,
  });

  if (moziCount !== 0) throw new Error("Mozi driver cleanup did not complete.");
}

main()
  .catch((error: unknown) => {
    console.error("Motion Drive seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
