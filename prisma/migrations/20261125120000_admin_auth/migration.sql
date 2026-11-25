CREATE TABLE IF NOT EXISTS "Admin" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(80) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "sessionToken" VARCHAR(255),
    "sessionExpiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Admin_username_key" ON "Admin"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "Admin_sessionToken_key" ON "Admin"("sessionToken");
CREATE INDEX IF NOT EXISTS "Admin_sessionExpiresAt_idx" ON "Admin"("sessionExpiresAt");
