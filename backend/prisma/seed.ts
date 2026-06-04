import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { username: "admin" } });

  if (existing) {
    console.log("⚠️  User admin sudah ada, skip seeding.");
    return;
  }
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("ADMIN_PASSWORD wajib diset di .env");

  await prisma.user.create({
    data: {
      username: "admin",
      email: "admin@epson.com",
      fullName: "Epson",
      hashedPassword: await bcrypt.hash(password, 12),
      role: "ADMIN",
    },
  });

  console.log("✅ Seeding selesai! User admin dibuat.");
  console.log("   Username : admin");
}

main()
  .catch((e: Error) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
