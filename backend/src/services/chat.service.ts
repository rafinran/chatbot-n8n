import fs from "fs";
import prisma from "../db.ts";
import { env, SESSION_MAX_ROWS } from "../config/env.ts";
import type { ChatMessage, N8nResponseDto } from "../dto/chat.dto.ts";

// ── Conversation helpers ──────────────────────────────────────────────────────

export async function getOrCreateConversation(userId: number): Promise<number> {
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
    const imageUrl: string | undefined = msg?.data?.imageUrl ?? undefined;
    return content ? [{ role, content, ...(imageUrl && { imageUrl }) }] : [];
  });
}

export async function appendSession(
  conversationId: number,
  userContent: string,
  assistantContent: string,
  imageUrl?: string
): Promise<void> {
  const userMessage: any = { type: "human", data: { type: "human", content: userContent } };
  if (imageUrl) userMessage.data.imageUrl = imageUrl;

  await prisma.n8n_chat_histories.createMany({
    data: [
      { conversationId, message: userMessage },
      { conversationId, message: { type: "ai", data: { type: "ai", content: assistantContent } } },
    ],
  });

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (conversation) {
    const updates: any = { updatedAt: new Date() };
    if (!conversation.title || conversation.title === "New conversation") {
      updates.title = userContent.slice(0, 50);
    }
    await prisma.conversation.update({ where: { id: conversationId }, data: updates });
  }

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

// ── Image analysis (OPTIMIZED) ────────────────────────────────────────────────

const IMAGE_ANALYSIS_TIMEOUT = 20 * 1000; // 20 seconds timeout

export async function analyzeImage(file: Express.Multer.File, message: string): Promise<string> {
  const base64 = fs.readFileSync(file.path).toString("base64");

  // Strict prompt to limit output to max 50 words
  const promptText = `${message}

PENTING: Analisis gambar MAKSIMAL 50 KATA. Fokus HANYA pada:
- Jenis masalah/defect (1-2 kata)
- Lokasi pada gambar (1-2 kata)
- Tingkat keparahan (1-2 kata)
- Rekomendasi singkat (3-5 kata)

JANGAN jelaskan panjang lebar. LANGSUNG KE POIN.`;

  // Try OpenCode MiniMax M3 (OpenAI-compatible)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), IMAGE_ANALYSIS_TIMEOUT);

  try {
    const ocRes = await Promise.race([
      fetch("https://api.opencode.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.opencodeApiKey}`,
        },
        body: JSON.stringify({
          model: "minimax/M3",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: promptText },
              { type: "image_url", image_url: { url: `data:${file.mimetype};base64,${base64}` } },
            ],
          }],
          max_tokens: 50,
        }),
        signal: controller.signal,
      }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Image analysis timeout")), IMAGE_ANALYSIS_TIMEOUT);
      }),
    ]);
    clearTimeout(timeoutId);
    const res = ocRes as Response;
    if (!res.ok) throw new Error(`OpenCode error: ${res.status}`);
    const data = await res.json() as any;
    return data.choices?.[0]?.message?.content ?? "";
  } catch (err) {
    clearTimeout(timeoutId);
    console.error("[CHAT] OpenCode MiniMax error: ", err);
    console.warn("[CHAT] Fallback ke OpenRouter Qwen...");
  }

  // Fallback via OpenRouter Qwen 3.5 Flash
  if (!env.openRouterApiKey) throw new Error("Sistem analisis gambar sedang tidak tersedia.");

  const controller2 = new AbortController();
  const timeoutId2 = setTimeout(() => controller2.abort(), IMAGE_ANALYSIS_TIMEOUT);

  try {
    const orRes = await Promise.race([
      fetch("https://openrouter.ai/api/v1/chat/completions", {
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
          max_tokens: 50,
        }),
        signal: controller2.signal,
      }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("OpenRouter timeout")), IMAGE_ANALYSIS_TIMEOUT);
      }),
    ]);
    clearTimeout(timeoutId2);
    const res = orRes as Response;
    if (!res.ok) throw new Error("OpenRouter error");
    const orData = await res.json() as any;
    return orData.choices?.[0]?.message?.content ?? "";
  } catch (err: any) {
    clearTimeout(timeoutId2);
    console.error("[CHAT] OpenRouter error: ", err);
    throw new Error("Sistem analisis gambar sedang tidak tersedia.");
  }
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
  /akan diteruskan ke tim admin/i,
  /akan dikirim ke admin/i,
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
