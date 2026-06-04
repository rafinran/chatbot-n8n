import fs from "fs";
import type { Request, Response } from "express";
import * as chatService from "../services/chat.service.ts";

export async function sendMessage(req: Request, res: Response): Promise<any> {
  const message = req.body.message?.trim();

  if (!message) {
    return res.status(400).json({ error: "Pesan tidak boleh kosong." });
  }

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
    await chatService.logChatActivity(req.user.id, message, n8nData.is_answered, !!req.file, req.file?.filename);

    res.json({ response: n8nData.answer, is_answered: n8nData.is_answered });
  } catch (err: any) {
    console.error("[CHAT] Error:", err.message);
    res.status(500).json({ error: "Gagal mendapatkan respons." });
  } finally {
    if (req.file?.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.warn("[CLEANUP] Gagal hapus file:", err.message);
      });
    }
  }
}

export async function getHistory(req: Request, res: Response): Promise<void> {
  const history = await chatService.getSession(req.user.id);
  res.json({ history });
}

export async function clearHistory(req: Request, res: Response): Promise<void> {
  await chatService.clearSession(req.user.id);
  res.json({ message: "Percakapan direset." });
}
