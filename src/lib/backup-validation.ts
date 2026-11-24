import { z } from "zod";
import { getStoredFileMimeType, MAX_UPLOAD_BYTES } from "./storage";

const id = z.string().min(1).max(255);
const nullableText = z.string().nullable();
const decimal = z.string().regex(/^-?(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/);

function isIsoTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

const timestamp = z.string().refine(isIsoTimestamp, "Expected a valid ISO timestamp.");
const nullableTimestamp = timestamp.nullable();

const vehicleSchema = z.object({
  id,
  registration: z.string().min(1).max(16),
  make: z.string().max(80).nullable(),
  model: z.string().min(1).max(120),
  fuelType: z.string().max(40).nullable(),
  year: z.number().int().nullable(),
  colour: z.string().max(60).nullable(),
  vin: z.string().max(32).nullable(),
  status: z.string().min(1).max(40),
  weeklyRent: decimal,
  bond: decimal,
  excess: decimal,
  kmAllowance: z.string().min(1).max(40),
  pickupLocation: z.string().min(1).max(160),
  odometer: z.number().int().nullable(),
  nextServiceKm: z.number().int().nullable(),
  registrationExpiry: nullableTimestamp,
  insuranceExpiry: nullableTimestamp,
  inspectionExpiry: nullableTimestamp,
  notes: nullableText,
  createdAt: timestamp,
  updatedAt: timestamp,
}).strict();

const driverSchema = z.object({
  id,
  name: z.string().min(1).max(160),
  mobile: z.string().min(1).max(40),
  email: z.string().max(254).nullable(),
  dateOfBirth: nullableTimestamp,
  address: nullableText,
  licenceNumber: z.string().max(80).nullable(),
  licenceState: z.string().max(40).nullable(),
  abn: z.string().max(30).nullable(),
  emergencyContact: nullableText,
  rideshareAccreditation: z.string().max(120).nullable(),
  licenceExpiry: nullableTimestamp,
  rideshareAccreditationExpiry: nullableTimestamp,
  status: z.string().min(1).max(40),
  notes: nullableText,
  createdAt: timestamp,
  updatedAt: timestamp,
}).strict();

const contractSchema = z.object({
  id,
  contractNumber: z.string().min(1).max(40),
  vehicleId: id,
  driverId: id,
  status: z.string().min(1).max(40),
  agreementDate: nullableTimestamp,
  startDate: timestamp,
  endDate: nullableTimestamp,
  initialEndDate: nullableTimestamp,
  weeklyRent: decimal,
  bond: decimal,
  excess: decimal,
  kmAllowance: z.string().min(1).max(40),
  term: z.string().min(1).max(80),
  noticePeriod: z.string().min(1).max(40),
  paymentFrequency: z.string().min(1).max(80),
  paymentMethod: z.string().min(1).max(40),
  rideshareUse: z.boolean(),
  privateUse: z.boolean(),
  endedAt: nullableTimestamp,
  createdAt: timestamp,
  updatedAt: timestamp,
  swapId: id.nullable(),
  swapLeg: z.string().max(1).nullable(),
}).strict();

const vehicleSwapSchema = z.object({
  id,
  swapNumber: z.string().min(1).max(40),
  swapDate: timestamp,
  driverOneId: id,
  driverTwoId: id,
  vehicleOneId: id,
  vehicleTwoId: id,
  newRentOne: decimal,
  newRentTwo: decimal,
  notes: nullableText,
  createdAt: timestamp,
}).strict();

const documentSchema = z.object({
  id,
  entityType: z.enum(["Driver", "Vehicle"]),
  documentType: z.string().min(1).max(100),
  originalName: z.string().min(1).max(255),
  storedName: z.string().min(1).max(255),
  storagePath: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(120),
  sizeBytes: z.string().regex(/^(?:0|[1-9]\d*)$/),
  expiryDate: nullableTimestamp,
  createdAt: timestamp,
  updatedAt: timestamp,
  vehicleId: id.nullable(),
  driverId: id.nullable(),
  contractId: id.nullable(),
}).strict();

const backupSchema = z.object({
  format: z.literal("MotionDrive_Backup"),
  version: z.literal(1),
  exportedAt: timestamp,
  records: z.object({
    vehicles: z.array(vehicleSchema),
    drivers: z.array(driverSchema),
    contracts: z.array(contractSchema),
    vehicleSwaps: z.array(vehicleSwapSchema),
    documents: z.array(documentSchema),
  }).strict(),
  files: z.array(z.object({
    storedName: z.string().min(1).max(255),
    originalName: z.string().min(1).max(255),
    mimeType: z.string().min(1).max(120),
    sizeBytes: z.number().int().min(0).max(MAX_UPLOAD_BYTES),
    modifiedAt: timestamp,
    dataBase64: z.string(),
  }).strict()),
}).strict();

export type BackupPayload = z.infer<typeof backupSchema>;

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupValidationError";
  }
}

function requireUnique<T>(values: T[], key: (value: T) => string, label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    const current = key(value);
    if (seen.has(current)) throw new BackupValidationError(`Duplicate ${label}: ${current}.`);
    seen.add(current);
  }
}

export function validateBackup(input: unknown): BackupPayload {
  const parsed = backupSchema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".") || "backup"}: ${issue.message}`)
      .join("; ");
    throw new BackupValidationError(`Invalid backup structure. ${details}`);
  }

  const backup = parsed.data;
  const { vehicles, drivers, contracts, vehicleSwaps, documents } = backup.records;
  requireUnique(vehicles, (row) => row.id, "vehicle ID");
  requireUnique(vehicles, (row) => row.registration, "vehicle registration");
  requireUnique(drivers, (row) => row.id, "driver ID");
  requireUnique(contracts, (row) => row.id, "contract ID");
  requireUnique(contracts, (row) => row.contractNumber, "contract number");
  requireUnique(vehicleSwaps, (row) => row.id, "vehicle swap ID");
  requireUnique(vehicleSwaps, (row) => row.swapNumber, "swap number");
  requireUnique(documents, (row) => row.id, "document ID");
  requireUnique(backup.files, (file) => file.storedName, "stored file name");

  const vehicleIds = new Set(vehicles.map((row) => row.id));
  const driverIds = new Set(drivers.map((row) => row.id));
  const contractIds = new Set(contracts.map((row) => row.id));
  const swapIds = new Set(vehicleSwaps.map((row) => row.id));
  const fileByName = new Map(backup.files.map((file) => [file.storedName, file]));

  for (const contract of contracts) {
    if (!vehicleIds.has(contract.vehicleId) || !driverIds.has(contract.driverId)) {
      throw new BackupValidationError(`Contract ${contract.id} references a missing vehicle or driver.`);
    }
    if (contract.swapId && !swapIds.has(contract.swapId)) {
      throw new BackupValidationError(`Contract ${contract.id} references a missing vehicle swap.`);
    }
  }

  for (const swap of vehicleSwaps) {
    if (!driverIds.has(swap.driverOneId) || !driverIds.has(swap.driverTwoId)) {
      throw new BackupValidationError(`Vehicle swap ${swap.id} references a missing driver.`);
    }
    if (!vehicleIds.has(swap.vehicleOneId) || !vehicleIds.has(swap.vehicleTwoId)) {
      throw new BackupValidationError(`Vehicle swap ${swap.id} references a missing vehicle.`);
    }
  }

  for (const file of backup.files) {
    let expectedMimeType: string;
    try {
      expectedMimeType = getStoredFileMimeType(file.storedName);
    } catch {
      throw new BackupValidationError(`Invalid stored file name: ${file.storedName}.`);
    }
    if (file.mimeType !== expectedMimeType) {
      throw new BackupValidationError(`File type does not match stored name: ${file.storedName}.`);
    }

    const data = Buffer.from(file.dataBase64, "base64");
    if (data.toString("base64") !== file.dataBase64 || data.byteLength !== file.sizeBytes) {
      throw new BackupValidationError(`File data or size is invalid: ${file.storedName}.`);
    }
  }

  for (const document of documents) {
    const file = fileByName.get(document.storedName);
    if (!file || document.storagePath !== `storage/uploads/${document.storedName}`) {
      throw new BackupValidationError(`Document ${document.id} has no matching stored file.`);
    }
    if (BigInt(document.sizeBytes) !== BigInt(file.sizeBytes) || document.mimeType !== file.mimeType) {
      throw new BackupValidationError(`Document ${document.id} does not match its stored file.`);
    }
    if (
      document.entityType === "Vehicle"
        ? !document.vehicleId || document.driverId !== null || !vehicleIds.has(document.vehicleId)
        : !document.driverId || document.vehicleId !== null || !driverIds.has(document.driverId)
    ) {
      throw new BackupValidationError(`Document ${document.id} has an invalid owner.`);
    }
    if (document.contractId && !contractIds.has(document.contractId)) {
      throw new BackupValidationError(`Document ${document.id} references a missing contract.`);
    }
  }

  return backup;
}
