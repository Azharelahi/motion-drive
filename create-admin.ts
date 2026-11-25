import { hashPassword } from "./src/lib/password";
import { prisma } from "./src/lib/db";

async function main() {


  const existing = await prisma.admin.findUnique({ where: { username } });
  if (existing) {
    await prisma.admin.update({
      where: { id: existing.id },
      data: { passwordHash: await hashPassword(password) },
    });
    console.log(`Admin user "${username}" password updated.`);
  } else {
    await prisma.admin.create({
      data: { username, passwordHash: await hashPassword(password) },
    });
    console.log(`Admin user "${username}" created.`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
