import { z } from "zod";

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const isoDateSchema = z
  .string()
  .refine(isValidIsoDate, "Enter a valid date in YYYY-MM-DD format.");

export const optionalIsoDateSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  isoDateSchema.nullable().optional(),
);

export const registrationSchema = z
  .string()
  .trim()
  .min(1, "Registration is required.")
  .max(16, "Registration must be 16 characters or fewer.")
  .transform((value) => value.toUpperCase());

const maxMoney = 99_999_999.99;
const numericMoneySchema = z
  .coerce.number()
  .finite("Enter a valid amount.")
  .min(0, "Amount cannot be negative.")
  .max(maxMoney, "Amount exceeds the supported maximum.")
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7, {
    message: "Amount can have at most two decimal places.",
  });

export const moneySchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  numericMoneySchema,
);

export const optionalMoneySchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  numericMoneySchema.optional().nullable(),
);

export const optionalTextSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().nullable().optional(),
);

const optionalIntegerSchema = (minimum: number, maximum?: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z
      .coerce.number()
      .int()
      .min(minimum)
      .max(maximum ?? Number.MAX_SAFE_INTEGER)
      .nullable()
      .optional(),
  );

const optionalEmailSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().email().max(254).nullable().optional(),
);

export const documentEntityTypeSchema = z.enum(["Driver", "Vehicle"]);

export const vehicleInputSchema = z.object({
  registration: registrationSchema,
  make: optionalTextSchema,
  model: z.string().trim().min(1, "Model is required.").max(120),
  year: optionalIntegerSchema(1886, 9999),
  colour: optionalTextSchema,
  vin: optionalTextSchema,
  status: z.string().trim().min(1).max(40).default("Available"),
  weeklyRent: moneySchema,
  bond: optionalMoneySchema,
  excess: optionalMoneySchema,
  kmAllowance: z.string().trim().min(1).max(40).default("Unlimited"),
  pickupLocation: z.string().trim().min(1).max(160).default("Tarneit, VIC"),
  odometer: optionalIntegerSchema(0),
  nextServiceKm: optionalIntegerSchema(0),
  registrationExpiry: optionalIsoDateSchema,
  insuranceExpiry: optionalIsoDateSchema,
  inspectionExpiry: optionalIsoDateSchema,
  notes: optionalTextSchema,
});

export const driverInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(160),
  mobile: z.string().trim().min(1, "Mobile is required.").max(40),
  email: optionalEmailSchema,
  dateOfBirth: optionalIsoDateSchema,
  address: optionalTextSchema,
  licenceNumber: optionalTextSchema,
  licenceState: optionalTextSchema,
  licenceExpiry: optionalIsoDateSchema,
  rideshareAccreditationExpiry: optionalIsoDateSchema,
  status: z.string().trim().min(1).max(40).default("Ended"),
  notes: optionalTextSchema,
});

export const contractInputSchema = z.object({
  contractNumber: z.string().trim().min(1).max(40),
  vehicleId: z.string().trim().min(1),
  driverId: z.string().trim().min(1),
  status: z.string().trim().min(1).max(40).default("Active"),
  startDate: isoDateSchema,
  endDate: optionalIsoDateSchema,
  initialEndDate: optionalIsoDateSchema,
  weeklyRent: moneySchema,
  bond: optionalMoneySchema,
  excess: optionalMoneySchema,
  kmAllowance: z.string().trim().min(1).max(40).default("Unlimited"),
  term: z.string().trim().min(1).max(80).default("Month to month"),
  noticePeriod: z.string().trim().min(1).max(40).default("7 days"),
  paymentFrequency: z.string().trim().min(1).max(80).default("Weekly in advance"),
  paymentMethod: z.string().trim().min(1).max(40).default("Bank Transfer"),
  rideshareUse: z.boolean().default(true),
  privateUse: z.boolean().default(true),
});

export const swapInputSchema = z.object({
  swapNumber: z.string().trim().min(1).max(40),
  swapDate: isoDateSchema,
  driverOneId: z.string().trim().min(1),
  driverTwoId: z.string().trim().min(1),
  vehicleOneId: z.string().trim().min(1),
  vehicleTwoId: z.string().trim().min(1),
  newRentOne: moneySchema,
  newRentTwo: moneySchema,
  notes: optionalTextSchema,
});

export const documentInputSchema = z
  .object({
    entityType: documentEntityTypeSchema,
    documentType: z.string().trim().min(1).max(100),
    originalName: z.string().trim().min(1).max(255),
    storedName: z.string().trim().min(1).max(255),
    storagePath: z.string().trim().min(1).max(500),
    mimeType: z.string().trim().min(1).max(120),
    sizeBytes: z.coerce.bigint().positive(),
    expiryDate: optionalIsoDateSchema,
    vehicleId: optionalTextSchema,
    driverId: optionalTextSchema,
    contractId: optionalTextSchema,
  })
  .refine(
    ({ entityType, vehicleId, driverId }) =>
      entityType === "Vehicle" ? Boolean(vehicleId) && !driverId : Boolean(driverId) && !vehicleId,
    { message: "Choose exactly one matching driver or vehicle profile.", path: ["entityType"] },
  );
