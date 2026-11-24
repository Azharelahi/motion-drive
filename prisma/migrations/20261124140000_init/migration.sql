-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DocumentEntityType" AS ENUM ('Driver', 'Vehicle');

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "registration" VARCHAR(16) NOT NULL,
    "make" VARCHAR(80),
    "model" VARCHAR(120) NOT NULL,
    "year" INTEGER,
    "colour" VARCHAR(60),
    "vin" VARCHAR(32),
    "status" VARCHAR(40) NOT NULL DEFAULT 'Available',
    "weeklyRent" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "bond" DECIMAL(10,2) NOT NULL DEFAULT 500,
    "excess" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "kmAllowance" VARCHAR(40) NOT NULL DEFAULT 'Unlimited',
    "pickupLocation" VARCHAR(160) NOT NULL DEFAULT 'Tarneit, VIC',
    "odometer" INTEGER,
    "nextServiceKm" INTEGER,
    "registrationExpiry" DATE,
    "insuranceExpiry" DATE,
    "inspectionExpiry" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "mobile" VARCHAR(40) NOT NULL,
    "email" VARCHAR(254),
    "dateOfBirth" DATE,
    "address" TEXT,
    "licenceNumber" VARCHAR(80),
    "licenceState" VARCHAR(40),
    "licenceExpiry" DATE,
    "rideshareAccreditationExpiry" DATE,
    "status" VARCHAR(40) NOT NULL DEFAULT 'Ended',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleSwap" (
    "id" TEXT NOT NULL,
    "swapNumber" VARCHAR(40) NOT NULL,
    "swapDate" DATE NOT NULL,
    "driverOneId" TEXT NOT NULL,
    "driverTwoId" TEXT NOT NULL,
    "vehicleOneId" TEXT NOT NULL,
    "vehicleTwoId" TEXT NOT NULL,
    "newRentOne" DECIMAL(10,2) NOT NULL,
    "newRentTwo" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleSwap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "contractNumber" VARCHAR(40) NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'Active',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "initialEndDate" DATE,
    "weeklyRent" DECIMAL(10,2) NOT NULL,
    "bond" DECIMAL(10,2) NOT NULL DEFAULT 500,
    "excess" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "kmAllowance" VARCHAR(40) NOT NULL DEFAULT 'Unlimited',
    "term" VARCHAR(80) NOT NULL DEFAULT 'Month to month',
    "noticePeriod" VARCHAR(40) NOT NULL DEFAULT '7 days',
    "paymentFrequency" VARCHAR(80) NOT NULL DEFAULT 'Weekly in advance',
    "paymentMethod" VARCHAR(40) NOT NULL DEFAULT 'Bank Transfer',
    "rideshareUse" BOOLEAN NOT NULL DEFAULT true,
    "privateUse" BOOLEAN NOT NULL DEFAULT true,
    "endedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "swapId" TEXT,
    "swapLeg" VARCHAR(1),

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "entityType" "DocumentEntityType" NOT NULL,
    "documentType" VARCHAR(100) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "storedName" VARCHAR(255) NOT NULL,
    "storagePath" VARCHAR(500) NOT NULL,
    "mimeType" VARCHAR(120) NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "expiryDate" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "contractId" TEXT,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_registration_key" ON "Vehicle"("registration");
CREATE INDEX "Vehicle_status_idx" ON "Vehicle"("status");
CREATE INDEX "Driver_name_idx" ON "Driver"("name");
CREATE INDEX "Driver_mobile_idx" ON "Driver"("mobile");
CREATE UNIQUE INDEX "VehicleSwap_swapNumber_key" ON "VehicleSwap"("swapNumber");
CREATE INDEX "VehicleSwap_swapDate_idx" ON "VehicleSwap"("swapDate");
CREATE UNIQUE INDEX "Contract_contractNumber_key" ON "Contract"("contractNumber");
CREATE INDEX "Contract_vehicleId_status_idx" ON "Contract"("vehicleId", "status");
CREATE INDEX "Contract_driverId_status_idx" ON "Contract"("driverId", "status");
CREATE INDEX "Contract_startDate_idx" ON "Contract"("startDate");
CREATE UNIQUE INDEX "Document_storedName_key" ON "Document"("storedName");
CREATE INDEX "Document_vehicleId_expiryDate_idx" ON "Document"("vehicleId", "expiryDate");
CREATE INDEX "Document_driverId_expiryDate_idx" ON "Document"("driverId", "expiryDate");
CREATE INDEX "Document_contractId_idx" ON "Document"("contractId");

-- Enforce at most one active rental per vehicle and driver.
CREATE UNIQUE INDEX "Contract_one_active_per_vehicle"
    ON "Contract"("vehicleId") WHERE "status" = 'Active';
CREATE UNIQUE INDEX "Contract_one_active_per_driver"
    ON "Contract"("driverId") WHERE "status" = 'Active';

-- CreateForeignKey
ALTER TABLE "VehicleSwap" ADD CONSTRAINT "VehicleSwap_driverOneId_fkey" FOREIGN KEY ("driverOneId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleSwap" ADD CONSTRAINT "VehicleSwap_driverTwoId_fkey" FOREIGN KEY ("driverTwoId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleSwap" ADD CONSTRAINT "VehicleSwap_vehicleOneId_fkey" FOREIGN KEY ("vehicleOneId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleSwap" ADD CONSTRAINT "VehicleSwap_vehicleTwoId_fkey" FOREIGN KEY ("vehicleTwoId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_swapId_fkey" FOREIGN KEY ("swapId") REFERENCES "VehicleSwap"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A document belongs to exactly one profile. Contract links annotate agreement files.
ALTER TABLE "Document" ADD CONSTRAINT "Document_exactly_one_profile_check"
    CHECK (num_nonnulls("vehicleId", "driverId") = 1);
ALTER TABLE "Document" ADD CONSTRAINT "Document_entity_type_matches_profile_check"
    CHECK (("entityType" = 'Vehicle' AND "vehicleId" IS NOT NULL) OR ("entityType" = 'Driver' AND "driverId" IS NOT NULL));
