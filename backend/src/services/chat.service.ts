import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "../db.ts";
import { env, SESSION_MAX_ROWS } from "../config/env.ts";
import type { ChatMessage, N8nResponseDto } from "../dto/chat.dto.ts";

const genAI = new GoogleGenerativeAI(env.googleApiKey);

// ── Session helpers ───────────────────────────────────────────────────────────

export function sessionId(userId: number): string {
  return `user_${userId}`;
}

export async function getSession(userId: number): Promise<ChatMessage[]> {
  const rows = await prisma.n8n_chat_histories.findMany({
    where: { session_id: sessionId(userId) },
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
  userId: number,
  userContent: string,
  assistantContent: string
): Promise<void> {
  const sid = sessionId(userId);

  await prisma.n8n_chat_histories.createMany({
    data: [
      { session_id: sid, message: { type: "human", data: { type: "human", content: userContent } } },
      { session_id: sid, message: { type: "ai",    data: { type: "ai",    content: assistantContent } } },
    ],
  });

  // Trim ke SESSION_MAX_ROWS
  const allRows = await prisma.n8n_chat_histories.findMany({
    where: { session_id: sid },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (allRows.length > SESSION_MAX_ROWS) {
    const toDelete = allRows.slice(0, allRows.length - SESSION_MAX_ROWS).map((r) => r.id);
    await prisma.n8n_chat_histories.deleteMany({ where: { id: { in: toDelete } } });
  }
}

export async function clearSession(userId: number): Promise<void> {
  await prisma.n8n_chat_histories.deleteMany({ where: { session_id: sessionId(userId) } });
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
//
// n8n hanya set is_answered=false kalau workflow error. Kasus "tidak ada di
// knowledge base" atau "butuh klarifikasi" tetap lolos sebagai is_answered=true
// karena AI Agent sukses jalan. Fungsi ini mendeteksi pola jawaban LLM dan
// meng-override status sesuai kondisi sebenarnya.

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
