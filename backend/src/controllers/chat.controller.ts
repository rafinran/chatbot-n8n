import type { Request, Response } from "express";
import * as chatService from "../services/chat.service.ts";
import { maybeEscalate } from "../services/overview.service.ts";
import { SendMessageSchema } from "../dto/chat.dto.ts";
import { asyncHandler } from "../utils/asyncHandler.ts";

export const sendMessage = asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const parsed = SendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
  }

  const message = parsed.data.message;
  let conversationId = parsed.data.conversationId;

  // Get or create conversation if not provided
  if (!conversationId) {
    conversationId = await chatService.getOrCreateConversation(req.user.id);
  }

  let imageUrl: string | undefined;

  try {
    let question = message;

    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
      console.log("[CHAT] Gambar diterima, mulai analisis...");
      const imageAnalysis = await chatService.analyzeImage(req.file, message);
      question = `${message}\n\n[Hasil analisis gambar]:\n${imageAnalysis}`;
    }

    console.log("[CHAT] Kirim ke n8n, question length:", question.length);
    const n8nData = await chatService.callN8n(question, req.user.id, req.user.email);
    console.log("[CHAT] Response n8n:", n8nData);

    const isAnswered = chatService.resolveIsAnswered(n8nData.answer, n8nData.is_answered);
    console.log("[CHAT] is_answered (resolved):", isAnswered, "| raw:", n8nData.is_answered);

    await chatService.appendSession(conversationId, message, n8nData.answer, imageUrl);

    // Log ke ChatLog (bukan ActivityLog)
    const chatLogId = await chatService.logChat(
      req.user.id,
      message,
      isAnswered,
      !!req.file,
      req.file?.filename,
    );

    // Auto-escalate kalau tidak terjawab
    await maybeEscalate({
      chatLogId,
      userId:     req.user.id,
      isAnswered,
      confidence: (n8nData as any).confidence,
      question:   message,
    }).catch((err) => {
      console.warn("[CHAT] maybeEscalate error:", err.message);
    });

    res.json({ response: n8nData.answer, is_answered: isAnswered, conversationId, imageUrl });
  } catch (err: any) {
    console.error("[CHAT] Error:", err.message);
    res.status(500).json({ error: "Gagal memproses pesan." });
  }
});

export const getHistory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const conversationIdStr = (req.query.conversationId as string) || "";
  const conversationId = conversationIdStr ? parseInt(conversationIdStr, 10) : 
    await chatService.getOrCreateConversation(req.user.id);
  const history = await chatService.getSession(conversationId);
  res.json({ history, conversationId });
});

export const clearHistory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const conversationIdStr = (req.query.conversationId as string) || "";
  const conversationId = conversationIdStr ? parseInt(conversationIdStr, 10) :
    await chatService.getOrCreateConversation(req.user.id);
  await chatService.deleteConversation(conversationId);
  res.json({ message: "Conversation dihapus." });
});

export const listConversations = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const conversations = await chatService.listConversations(req.user.id);
  res.json({ conversations });
});

export const createConversation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { title } = req.body;
  const conversation = await chatService.createConversation(req.user.id, title);
  res.status(201).json({ conversation });
});

export const deleteConversation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const idStr = typeof req.params.id === "string" ? req.params.id : "";
  const conversationId = parseInt(idStr, 10);
  await chatService.deleteConversation(conversationId);
  res.json({ message: "Conversation dihapus." });
});

export const updateConversationTitle = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const idStr = typeof req.params.id === "string" ? req.params.id : "";
  const conversationId = parseInt(idStr, 10);
  const { title } = req.body;
  await chatService.updateConversationTitle(conversationId, title);
  res.json({ message: "Title diupdate." });
});

export const escalateChat = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { question } = req.body;
  if (!question || typeof question !== "string" || question.trim().length === 0) {
    res.status(400).json({ error: "Pertanyaan tidak boleh kosong." });
    return;
  }

  const chatLogId = await chatService.logChat(req.user.id, question, false, false);
  await maybeEscalate({
    chatLogId,
    userId: req.user.id,
    isAnswered: false,
    question,
  }).catch((err) => {
    console.warn("[CHAT] manual escalate error:", err.message);
  });

  res.json({ message: "Pertanyaan diteruskan ke tim admin." });
});
