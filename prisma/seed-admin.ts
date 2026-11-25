import { hashPassword } from "../src/lib/password";
import { prisma } from "../src/lib/db";

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD must be set in .env");
  }

  const existing = await prisma.admin.findUnique({ where: { username } });
  if (existing) {
    await prisma.admin.update({
      where: { id: existing.id },
      data: { passwordHash: await hashPassword(password) },
    });
    console.log(`Admin user "${username}" password updated.`);
    return;
  }

  await prisma.admin.create({
    data: { username, passwordHash: await hashPassword(password) },
  });

  console.log(`Admin user "${username}" created successfully.`);
}

main()
  .then(() => {
    console.log("Admin seed complete.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Admin seed failed:", error);
    process.exit(1);
  });
