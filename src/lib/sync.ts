import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { deleteStoredFile, readStoredFile, saveUpload, type StoredUpload } from "./storage";
import {
  isMoziDriverName,
  seedData,
  signedAgreementPdfs,
  type VehicleSeed,
  type DriverSeed,
  type ContractSeed,
  type DocumentSeed,
} from "./seed-data";

type ActiveContract = {
  id: string;
  vehicleId: string;
  driverId: string;
  status: string;
  createdAt: Date;
  startDate: Date;
};

export interface SyncResult {
  vehiclesMerged: number;
  driversMerged: number;
  contractsMerged: number;
  documentsMerged: number;
  duplicateActiveContractsEnded: number;
  moziDriversRemoved: number;
}

function dateOnly(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function dateTime(value: string | null): Date | undefined {
  return value ? new Date(value) : undefined;
}

function normalized(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-AU");
}

function registrationKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLocaleUpperCase("en-AU");
}

function activeStatus(value: string): boolean {
  return normalized(value) === "active";
}

function latestContract(left: ActiveContract, right: ActiveContract): ActiveContract {
  if (left.createdAt.getTime() !== right.createdAt.getTime()) {
    return left.createdAt > right.createdAt ? left : right;
  }
  if (left.startDate.getTime() !== right.startDate.getTime()) {
    return left.startDate > right.startDate ? left : right;
  }
  return left.id > right.id ? left : right;
}

export function findDuplicateActiveContractIds(
  contracts: ActiveContract[],
): string[] {
  const ended = new Set<string>();
  const active = contracts.filter((contract) => activeStatus(contract.status));

  for (const field of ["vehicleId", "driverId"] as const) {
    const groups = new Map<string, ActiveContract[]>();
    for (const contract of active) {
      const key = contract[field];
      groups.set(key, [...(groups.get(key) ?? []), contract]);
    }

    for (const group of groups.values()) {
      if (group.length < 2) continue;
      let keeper = group[0];
      for (const contract of group.slice(1)) {
        keeper = latestContract(keeper, contract);
      }
      for (const contract of group) {
        if (contract.id !== keeper.id) ended.add(contract.id);
      }
    }
  }

  return [...ended];
}

async function storeSeedAgreementFiles(): Promise<{
  byKey: Map<string, StoredUpload>;
  newlyStoredNames: string[];
}> {
  const byKey = new Map<string, StoredUpload>();
  const newlyStoredNames: string[] = [];

  for (const agreement of signedAgreementPdfs) {
    const linkedDocumentIds = seedData.documents
      .filter((document) => document.embeddedKey === agreement.embeddedKey)
      .map((document) => document.id);
    const existingDocuments = await prisma.document.findMany({
      where: { id: { in: linkedDocumentIds } },
      select: { storedName: true, originalName: true, mimeType: true, sizeBytes: true, storagePath: true },
    });

    for (const document of existingDocuments) {
      try {
        const content = await readStoredFile(document.storedName);
        if (content.subarray(0, 5).toString("ascii") === "%PDF-") {
          byKey.set(agreement.embeddedKey, {
            storedName: document.storedName,
            originalName: document.originalName,
            mimeType: document.mimeType,
            sizeBytes: Number(document.sizeBytes),
            storagePath: document.storagePath,
          });
          break;
        }
      } catch {
        // Restore the embedded seed copy if the existing file is missing or unreadable.
      }
    }

    if (byKey.has(agreement.embeddedKey)) continue;

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

function vehicleCreateData(vehicle: VehicleSeed) {
  return {
    id: vehicle.id,
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
}

function driverCreateData(driver: DriverSeed) {
  return {
    id: driver.id,
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
}

function contractCreateData(contract: ContractSeed) {
  return {
    id: contract.id,
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
}

export async function syncSeedDatabase(): Promise<SyncResult> {
  const { byKey: signedFiles, newlyStoredNames } = await storeSeedAgreementFiles();

  try {
    return await prisma.$transaction(async (transaction) => {
      const moziDrivers = await transaction.driver.findMany({
        select: { id: true, name: true },
      });
      const moziIds = moziDrivers
        .filter((driver) => isMoziDriverName(driver.name))
        .map((driver) => driver.id);

      if (moziIds.length > 0) {
        await transaction.vehicleSwap.deleteMany({
          where: {
            OR: [
              { driverOneId: { in: moziIds } },
              { driverTwoId: { in: moziIds } },
            ],
          },
        });
        await transaction.contract.deleteMany({ where: { driverId: { in: moziIds } } });
        await transaction.document.deleteMany({ where: { driverId: { in: moziIds } } });
        await transaction.driver.deleteMany({ where: { id: { in: moziIds } } });
      }

      const vehicleRows = await transaction.vehicle.findMany({
        orderBy: { createdAt: "asc" },
      });
      const vehicleGroups = new Map<string, typeof vehicleRows>();
      for (const vehicle of vehicleRows) {
        const key = registrationKey(vehicle.registration);
        vehicleGroups.set(key, [...(vehicleGroups.get(key) ?? []), vehicle]);
      }

      for (const vehicles of vehicleGroups.values()) {
        if (vehicles.length < 2) continue;
        const keeper =
          vehicles.find((vehicle) => seedData.vehicles.some((seed) => seed.id === vehicle.id)) ??
          vehicles[0];
        for (const vehicle of vehicles) {
          if (vehicle.id !== keeper.id) {
            await transaction.contract.updateMany({
              where: { vehicleId: vehicle.id },
              data: { vehicleId: keeper.id },
            });
            await transaction.document.updateMany({
              where: { vehicleId: vehicle.id },
              data: { vehicleId: keeper.id },
            });
            await transaction.vehicleSwap.updateMany({
              where: { vehicleOneId: vehicle.id },
              data: { vehicleOneId: keeper.id },
            });
            await transaction.vehicleSwap.updateMany({
              where: { vehicleTwoId: vehicle.id },
              data: { vehicleTwoId: keeper.id },
            });
            await transaction.vehicle.delete({ where: { id: vehicle.id } });
          }
        }
      }

      const driverRows = await transaction.driver.findMany({
        orderBy: { createdAt: "asc" },
      });
      const driverGroups = new Map<string, typeof driverRows>();
      for (const driver of driverRows) {
        const key = normalized(driver.mobile);
        driverGroups.set(key, [...(driverGroups.get(key) ?? []), driver]);
      }
      for (const drivers of driverGroups.values()) {
        if (drivers.length < 2) continue;
        const keeper =
          drivers.find((driver) => seedData.drivers.some((seed) => seed.id === driver.id)) ??
          drivers[0];
        for (const driver of drivers) {
          if (driver.id !== keeper.id) {
            await transaction.contract.updateMany({
              where: { driverId: driver.id },
              data: { driverId: keeper.id },
            });
            await transaction.document.updateMany({
              where: { driverId: driver.id },
              data: { driverId: keeper.id },
            });
            await transaction.vehicleSwap.deleteMany({
              where: {
                OR: [
                  { driverOneId: driver.id },
                  { driverTwoId: driver.id },
                ],
              },
            });
            await transaction.driver.delete({ where: { id: driver.id } });
          }
        }
      }

      let vehiclesMerged = 0;
      for (const vehicle of seedData.vehicles) {
        const existingById = await transaction.vehicle.findUnique({ where: { id: vehicle.id } });
        const existingByRegistration = await transaction.vehicle.findUnique({
          where: { registration: vehicle.registration },
        });
        if (!existingById && !existingByRegistration) {
          await transaction.vehicle.create({ data: vehicleCreateData(vehicle) });
          vehiclesMerged += 1;
        }
      }

      let driversMerged = 0;
      for (const driver of seedData.drivers.filter((seed) => !isMoziDriverName(seed.name))) {
        const existingById = await transaction.driver.findUnique({ where: { id: driver.id } });
        const existingByMobile = await transaction.driver.findFirst({
          where: { mobile: driver.mobile },
        });
        if (!existingById && !existingByMobile) {
          await transaction.driver.create({ data: driverCreateData(driver) });
          driversMerged += 1;
        }
      }

      let contractsMerged = 0;
      for (const contract of seedData.contracts.filter((contract) =>
        seedData.drivers.some((driver) => driver.id === contract.driverId && !isMoziDriverName(driver.name)),
      )) {
        const existingById = await transaction.contract.findUnique({ where: { id: contract.id } });
        const existingByNumber = await transaction.contract.findUnique({
          where: { contractNumber: contract.contractNumber },
        });
        if (!existingById && !existingByNumber) {
          await transaction.contract.create({ data: contractCreateData(contract) });
          contractsMerged += 1;
        }
      }

      let documentsMerged = 0;
      for (const document of seedData.documents) {
        if (document.entityType === "Driver") {
          const ownerExists = await transaction.driver.findUnique({ where: { id: document.ownerId } });
          if (!ownerExists) continue;
        } else {
          const ownerExists = await transaction.vehicle.findUnique({ where: { id: document.ownerId } });
          if (!ownerExists) continue;
        }

        const existing = await transaction.document.findUnique({ where: { id: document.id } });
        if (existing) continue;
        const storedFile = signedFiles.get(document.embeddedKey);
        if (!storedFile) throw new Error(`Missing embedded agreement ${document.embeddedKey}.`);

        await transaction.document.create({
          data: {
            id: document.id,
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
          },
        });
        documentsMerged += 1;
      }

      const activeContracts = await transaction.contract.findMany({
        where: { status: { equals: "Active", mode: "insensitive" } },
        select: { id: true, vehicleId: true, driverId: true, status: true, createdAt: true, startDate: true },
      });
      const duplicateIds = findDuplicateActiveContractIds(activeContracts);
      if (duplicateIds.length > 0) {
        const now = new Date();
        await transaction.contract.updateMany({
          where: { id: { in: duplicateIds } },
          data: { status: "Ended", endedAt: now, endDate: now },
        });
      }

      const contractsAfterSync = await transaction.contract.findMany({
        where: { status: { equals: "Active", mode: "insensitive" } },
        select: { vehicleId: true, driverId: true },
      });
      const rentedVehicleIds = new Set(contractsAfterSync.map((contract) => contract.vehicleId));
      const currentDriverIds = new Set(contractsAfterSync.map((contract) => contract.driverId));

      await transaction.vehicle.updateMany({
        data: { status: "Available" },
        where: { id: { notIn: [...rentedVehicleIds] } },
      });
      await transaction.vehicle.updateMany({
        data: { status: "Rented" },
        where: { id: { in: [...rentedVehicleIds] } },
      });
      await transaction.driver.updateMany({
        data: { status: "Ended" },
        where: { id: { notIn: [...currentDriverIds] } },
      });
      await transaction.driver.updateMany({
        data: { status: "Current" },
        where: { id: { in: [...currentDriverIds] } },
      });

      return {
        vehiclesMerged,
        driversMerged,
        contractsMerged,
        documentsMerged,
        duplicateActiveContractsEnded: duplicateIds.length,
        moziDriversRemoved: moziIds.length,
      };
    });
  } catch (error) {
    await Promise.allSettled(
      newlyStoredNames.map((storedName) => deleteStoredFile(storedName)),
    );
    throw error;
  }
}
