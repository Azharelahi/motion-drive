import { loadEnvConfig } from "@next/env";
import { hashPassword } from "../src/lib/password";

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());

  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || username.length > 80) {
    throw new Error("Set ADMIN_USERNAME to a non-empty value of at most 80 characters.");
  }
  if (!password || password.length < 12 || password.length > 256) {
    throw new Error("Set ADMIN_PASSWORD to a strong password between 12 and 256 characters.");
  }

  const passwordHash = await hashPassword(password);
  const { prisma } = await import("../src/lib/db");

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.admin.deleteMany();
      await transaction.admin.create({ data: { username, passwordHash } });
    });
    console.info(`Admin account replaced for username "${username}".`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Admin account replacement failed", error);
  process.exitCode = 1;
});
