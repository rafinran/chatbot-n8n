import type { Request, Response, NextFunction } from "express";
import { generateAndSendReport } from "../services/report.service.ts";

export async function sendReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const type = (req.query.type as string) === "daily" ? "daily" : "weekly";
    const result = await generateAndSendReport(type);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
