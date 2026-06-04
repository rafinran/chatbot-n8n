
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../db.ts";
import { env, COOKIE_MAX_AGE, JWT_EXPIRES_IN } from "../config/env.ts";
import type { RegisterDto, LoginDto, UserResponseDto } from "../dto/auth.dto.ts";
import type { Response } from "express";

export function setAuthCookie(res: Response, token: string): void {
  res.cookie("access_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    maxAge: COOKIE_MAX_AGE,
  });
}

export function signToken(userId: number, username: string): string {
  return jwt.sign({ userId, username }, env.jwtSecret, { expiresIn: JWT_EXPIRES_IN });
}

export function formatUser(user: any): UserResponseDto {
  return { username: user.username, fullName: user.fullName, email: user.email, role: user.role };
}

export async function registerUser(dto: RegisterDto) {
  const { username, email, fullName, password } = dto;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });
  if (existing) throw { status: 400, message: "Username atau email sudah terdaftar." };

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { username, email, fullName, hashedPassword } });

  await prisma.activityLog.create({ data: { userId: user.id, action: "register" } });
  return user;
}

export async function loginUser(dto: LoginDto) {
  const { username, password } = dto;

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await bcrypt.compare(password, user.hashedPassword))) {
    throw { status: 401, message: "Username atau password salah." };
  }
  if (!user.isActive) throw { status: 403, message: "Akun tidak aktif." };

  await prisma.activityLog.create({ data: { userId: user.id, action: "login" } });
  return user;
}

export async function logoutUser(userId: number): Promise<void> {
  await prisma.activityLog.create({ data: { userId, action: "logout" } });
}
