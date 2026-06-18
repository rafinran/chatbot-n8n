import type { Request, Response, NextFunction } from "express";
import prisma from "../db.ts";

export const IMAGE_DAILY_LIMIT = 3;

export async function imageUploadLimit(req: Request, res: Response, next: NextFunction): Promise<any> {
  const contentType = req.headers["content-type"] ?? "";
  if (!contentType.includes("multipart/form-data")) return next();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const count = await prisma.chatLog.count({
    where: {
      userId: req.user!.id,
      createdAt: { gte: today },
      hasImage: true,
    },
  });

  if (count >= IMAGE_DAILY_LIMIT) {
    return res.status(429).json({
      error: `Batas upload gambar hari ini tercapai (${IMAGE_DAILY_LIMIT}x). Silakan coba lagi besok.`,
    });
  }

  next();
}
