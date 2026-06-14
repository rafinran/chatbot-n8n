import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "../db.ts";
import { env, SESSION_MAX_ROWS } from "../config/env.ts";
import type { ChatMessage, N8nResponseDto } from "../dto/chat.dto.ts";

const genAI = new GoogleGenerativeAI(env.googleApiKey);

// ── Conversation helpers ──────────────────────────────────────────────────────

export async function getOrCreateConversation(userId: number): Promise<number> {
  // Return conversation aktif (paling recent), atau buat baru jika tidak ada
  let conversation = await prisma.conversation.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { userId, title: "New conversation" },
    });
  }

  return conversation.id;
}

export async function createConversation(
  userId: number,
  title?: string
): Promise<{ id: number; title: string | null }> {
  const conversation = await prisma.conversation.create({
    data: { userId, title: title || "New conversation" },
  });
  return { id: conversation.id, title: conversation.title };
}

export async function listConversations(userId: number): Promise<any[]> {
  const conversations = await prisma.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
  return conversations;
}

export async function deleteConversation(conversationId: number): Promise<void> {
  await prisma.conversation.delete({ where: { id: conversationId } });
}

export async function updateConversationTitle(
  conversationId: number,
  title: string
): Promise<void> {
  await prisma.conversation.update({ where: { id: conversationId }, data: { title } });
}

// ── Session helpers ──────────────────────────────────────────────────────────

export async function getSession(conversationId: number): Promise<ChatMessage[]> {
  const rows = await prisma.n8n_chat_histories.findMany({
    where: { conversationId },
    orderBy: { id: "asc" },
  });

  return rows.flatMap((row) => {
    const msg = row.message as any;
    const role: "user" | "assistant" = msg?.data?.type === "human" ? "user" : "assistant";
    const content: string = msg?.data?.content ?? "";
    return content ? [{ role, content }] : [];
  });
}

export async function appendSession(
  conversationId: number,
  userContent: string,
  assistantContent: string
): Promise<void> {
  await prisma.n8n_chat_histories.createMany({
    data: [
      { conversationId, message: { type: "human", data: { type: "human", content: userContent } } },
      { conversationId, message: { type: "ai", data: { type: "ai", content: assistantContent } } },
    ],
  });

  // Update conversation timestamp & auto-generate title from first message if not set
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (conversation) {
    const updates: any = { updatedAt: new Date() };
    if (!conversation.title || conversation.title === "New conversation") {
      // Generate title dari first 50 chars of user content
      updates.title = userContent.slice(0, 50);
    }
    await prisma.conversation.update({ where: { id: conversationId }, data: updates });
  }

  // Trim ke SESSION_MAX_ROWS
  const allRows = await prisma.n8n_chat_histories.findMany({
    where: { conversationId },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (allRows.length > SESSION_MAX_ROWS) {
    const toDelete = allRows.slice(0, allRows.length - SESSION_MAX_ROWS).map((r) => r.id);
    await prisma.n8n_chat_histories.deleteMany({ where: { id: { in: toDelete } } });
  }
}

// ── Image analysis ────────────────────────────────────────────────────────────

export async function analyzeImage(file: Express.Multer.File, message: string): Promise<string> {
  const base64 = fs.readFileSync(file.path).toString("base64");
  const promptText = `${message}\n\nAnalisis gambar ini secara detail. Jika ada defect atau masalah kualitas cetak, sebutkan: jenis masalah, lokasi pada gambar, tingkat keparahan, dan rekomendasi tindak lanjut.`;

  // Coba Gemini Cloud dulu
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
    const result = await model.generateContent([
      promptText,
      { inlineData: { mimeType: file.mimetype, data: base64 } },
    ]);
    return result.response.text();
  } catch (err) {
    console.error("[CHAT] Gemini error: ", err);
    console.warn("[CHAT] Fallback ke openRouter...");
  }

  // Fallback via OpenRouter
  if (!env.openRouterApiKey) throw new Error("Sistem analisis gambar sedang tidak tersedia.");

  const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.openRouterApiKey}`,
    },
    body: JSON.stringify({
      model: "qwen/qwen3.5-flash-02-23",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: promptText },
          { type: "image_url", image_url: { url: `data:${file.mimetype};base64,${base64}` } },
        ],
      }],
    }),
  });
  if (!orRes.ok) throw new Error("Sistem analisis gambar sedang tidak tersedia.");

  const orData = await orRes.json() as any;
  return orData.choices?.[0]?.message?.content ?? "";
}

// ── Answer status resolution ──────────────────────────────────────────────────

const UNANSWERED_PATTERNS: RegExp[] = [
  /tidak memiliki informasi mengenai/i,
  /saya tidak memiliki informasi/i,
  /silakan hubungi customer service epson/i,
  /tidak dapat menemukan informasi/i,
  /tidak ada informasi.*tersebut/i,
  /di luar cakupan/i,
  /tidak tersedia dalam knowledge base/i,
];

export function resolveIsAnswered(answer: string, n8nIsAnswered: boolean): boolean {
  if (!n8nIsAnswered) return false;
  if (UNANSWERED_PATTERNS.some((p) => p.test(answer))) return false;
  return true;
}

// ── n8n call ──────────────────────────────────────────────────────────────────

export async function callN8n(question: string, userId: number, userEmail: string): Promise<N8nResponseDto> {
  const res = await fetch(env.n8nWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, user_id: String(userId), user_email: userEmail }),
  });
  if (!res.ok) throw new Error(`n8n workflow error: ${res.status}`);
  return res.json() as Promise<N8nResponseDto>;
}

// ── Activity log (audit trail: login/logout) ──────────────────────────────────

export async function logActivity(userId: number, action: string): Promise<void> {
  await prisma.activityLog.create({
    data: { userId, action },
  });
}

// ── Chat log ──────────────────────────────────────────────────────────────────

export async function logChat(
  userId: number,
  message: string,
  isAnswered: boolean,
  hasImage: boolean,
  imagePath?: string
): Promise<number> {
  const log = await prisma.chatLog.create({
    data: {
      userId,
      question: message.slice(0, 500),
      isAnswered,
      hasImage,
      ...(imagePath && { imagePath }),
    },
  });
  return log.id;
}
