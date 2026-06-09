import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.ts";
import * as overviewService from "../services/overview.service.ts";

// ── Overview ──────────────────────────────────────────────────────────────────

export const getStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await overviewService.getOverviewStats();
  res.json(stats);
});

export const getChatVolume = asyncHandler(async (_req: Request, res: Response) => {
  const volume = await overviewService.getChatVolume();
  res.json({ volume });
});

export const getTopTopics = asyncHandler(async (_req: Request, res: Response) => {
  const topics = await overviewService.getTopTopics();
  res.json({ topics });
});

// ── Escalation ────────────────────────────────────────────────────────────────

export const getEscalationStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await overviewService.getEscalationStats();
  res.json(stats);
});

export const listEscalations = asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;
  const tickets = await overviewService.getEscalationTickets(status, search);
  res.json({ tickets });
});

export const resolveEscalation = asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) return res.status(400).json({ error: "ID tidak valid." });
  await overviewService.resolveEscalation(id);
  res.json({ message: "Tiket berhasil diselesaikan." });
});
