ALTER TABLE "Vehicle" ADD COLUMN "fuelType" VARCHAR(40);

ALTER TABLE "Driver"
    ADD COLUMN "abn" VARCHAR(30),
    ADD COLUMN "emergencyContact" TEXT,
    ADD COLUMN "rideshareAccreditation" VARCHAR(120);

ALTER TABLE "Contract" ADD COLUMN "agreementDate" DATE;

DROP INDEX "Document_storedName_key";
