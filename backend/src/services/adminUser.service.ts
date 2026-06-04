import prisma from "../db.ts";

export async function listUsers() {
  return prisma.user.findMany({
    select: { id: true, username: true, email: true, fullName: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function toggleUserStatus(id: number, isActive: boolean) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw { status: 404, message: "User tidak ditemukan." };
  return prisma.user.update({ where: { id }, data: { isActive } });
}

export async function updateUserRole(id: number, role: "USER" | "ADMIN") {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw { status: 404, message: "User tidak ditemukan." };
  return prisma.user.update({ where: { id }, data: { role } });
}