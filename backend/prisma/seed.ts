import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { username: "admin" } });

  if (existing) {
    console.log("⚠️  User admin sudah ada, skip seeding.");
    return;
  }

  await prisma.user.create({
    data: {
      username: "admin",
      email: "admin@epson.com",
      fullName: "Epson",
      hashedPassword: await bcrypt.hash("password", 12),
    },
  });

  console.log("✅ Seeding selesai! User admin dibuat.");
  console.log("   Username : admin");
  console.log("   Password : password");
}

main()
  .catch((e: Error) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
