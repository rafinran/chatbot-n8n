import type { Request, Response, NextFunction } from "express";
import prisma from "../db.ts";

export function getClientIp(req: Request): string {
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (typeof xForwardedFor === "string") {
    return xForwardedFor.split(",")[0].trim();
  }
  if (Array.isArray(xForwardedFor)) {
    return xForwardedFor[0];
  }
  return req.ip || "unknown";
}

export async function logActivityLog(
  userId: number,
  action: string,
  req: Request,
  success: boolean = true,
  metadata?: Record<string, any>
): Promise<void> {
  const ipAddress = getClientIp(req);
  const userAgent = req.headers["user-agent"];

  await prisma.activityLog.create({
    data: {
      userId,
      action,
      ipAddress,
      userAgent,
      success,
      metadata,
    },
  });
}
