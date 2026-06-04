import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../db.ts";
import { env } from "../config/env.ts";

interface AuthPayload {
  userId: number;
  username: string;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<any> {
  const token = req.cookies?.access_token;
  if (!token) {
    return res.status(401).json({ error: "Sesi tidak ditemukan. Silakan login." });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthPayload;
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Akun tidak valid atau tidak aktif." });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Sesi tidak valid atau sudah berakhir." });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): any {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Akses ditolak. Hanya admin yang diizinkan." });
  }
  next();
}
