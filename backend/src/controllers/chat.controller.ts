import fs from "fs";
import type { Request, Response } from "express";
import * as chatService from "../services/chat.service.ts";
import { maybeEscalate } from "../services/overview.service.ts";
import { SendMessageSchema } from "../dto/chat.dto.ts";
import { asyncHandler } from "../utils/asyncHandler.ts";
import prisma from "../db.ts";

export const sendMessage = asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const parsed = SendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
  }

  const message = parsed.data.message;

  try {
    let question = message;

    if (req.file) {
      console.log("[CHAT] Gambar diterima, mulai analisis...");
      const imageAnalysis = await chatService.analyzeImage(req.file, message);
      question = `${message}\n\n[Hasil analisis gambar]:\n${imageAnalysis}`;
    }

    console.log("[CHAT] Kirim ke n8n, question length:", question.length);
    const n8nData = await chatService.callN8n(question, req.user.id, req.user.email);
    console.log("[CHAT] Response n8n:", n8nData);

    const userContent = req.file ? `[Gambar] ${message}` : message;
    await chatService.appendSession(req.user.id, userContent, n8nData.answer);

    // Log aktivitas
    await chatService.logChatActivity(
      req.user.id,
      message,
      n8nData.is_answered,
      !!req.file,
      req.file?.filename,
    );

    // Auto-escalate kalau tidak terjawab atau confidence rendah
    // Ambil log yang baru saja dibuat
    const latestLog = await prisma.activityLog.findFirst({
      where: { userId: req.user.id },
      orderBy: { id: "desc" },
    });

    if (latestLog) {
      await maybeEscalate({
        logId:      latestLog.id,
        userId:     req.user.id,
        isAnswered: n8nData.is_answered,
        confidence: (n8nData as any).confidence,
        question:   message,
      }).catch((err) => {
        // Jangan sampai error escalation gagalkan response chat
        console.warn("[CHAT] maybeEscalate error:", err.message);
      });
    }

    res.json({ response: n8nData.answer, is_answered: n8nData.is_answered });
  } finally {
    if (req.file?.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.warn("[CLEANUP] Gagal hapus file:", err.message);
      });
    }
  }
});

export const getHistory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const history = await chatService.getSession(req.user.id);
  res.json({ history });
});

export const clearHistory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await chatService.clearSession(req.user.id);
  res.json({ message: "Percakapan direset." });
});
