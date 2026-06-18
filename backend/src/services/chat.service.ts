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

  const promptText = `${message}

PENTING: Analisis gambar MAKSIMAL 50 KATA. Fokus HANYA pada:
- Jenis masalah/defect (10-15 kata)
- Lokasi pada gambar (10 kata)
- Tingkat keparahan (10 kata)
- Rekomendasi singkat (15-20 kata)

JANGAN jelaskan panjang lebar. LANGSUNG KE POIN.`;

  if (!env.openRouterApiKey) throw new Error("Sistem analisis gambar sedang tidak tersedia.");

  const basePayload = {
    messages: [{
      role: "user" as const,
      content: [
        { type: "text" as const, text: promptText },
        { type: "image_url" as const, image_url: { url: `data:${file.mimetype};base64,${base64}` } },
      ],
    }],
    max_tokens: 50,
  };

  // Primary: Gemini 3.1 Flash
  {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_ANALYSIS_TIMEOUT);
    try {
      const res = await Promise.race([
        fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.openRouterApiKey}`,
          },
          body: JSON.stringify({ model: "google/gemini-3.1-flash-lite", ...basePayload }),
          signal: controller.signal,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Image analysis timeout")), IMAGE_ANALYSIS_TIMEOUT)),
      ]);
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json() as any;
        return data.choices?.[0]?.message?.content ?? "";
      }
      console.warn(`[CHAT] Gemini 3.1 Flash gagal (${res.status}), fallback ke Qwen...`);
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn("[CHAT] Gemini 3.1 Flash error:", err.message, "fallback ke Qwen...");
    }
  }

  // Fallback: Qwen 3.5 Flash
  {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_ANALYSIS_TIMEOUT);
    try {
      const res = await Promise.race([
        fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.openRouterApiKey}`,
          },
          body: JSON.stringify({ model: "qwen/qwen3.5-flash-02-23", ...basePayload }),
          signal: controller.signal,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Image analysis timeout")), IMAGE_ANALYSIS_TIMEOUT)),
      ]);
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`OpenRouter error: ${res.status}`);
      const data = await res.json() as any;
      return data.choices?.[0]?.message?.content ?? "";
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error("[CHAT] Qwen fallback error:", err);
      throw new Error("Sistem analisis gambar sedang tidak tersedia.");
    }
  }
}

// ── Answer status resolution ──────────────────────────────────────────────────

const UNANSWERED_PATTERNS: RegExp[] = [
  /tidak memiliki informasi/i,
  /saya tidak memiliki/i,
  /silakan hubungi customer service/i,
  /tidak dapat menemukan/i,
  /tidak ada informasi/i,
  /di luar cakupan/i,
  /tidak tersedia/i,
  /belum tersedia/i,
  /akan diteruskan ke tim admin/i,
  /akan dikirim ke admin/i,
  /tidak cukup untuk menjawab/i,
  /hanya dapat membantu pertanyaan/i,
  /di luar domain/i,
  /belum cukup untuk/i,
  /mohon jelaskan kendala/i,
  /pertanyaan anda akan diteruskan/i,
  /diteruskan ke tim/i,
  /saya hanya bisa membantu/i,
  /saya tidak bisa menjawab/i,
  /tidak ditemukan/i,
  /tidak ada dokumen yang relevan/i,
  /i cannot answer/i,
  /i don't have information/i,
  /outside the scope/i,
  /not available in/i,
  /please contact.*support/i,
];

export function resolveIsAnswered(answer: string, n8nIsAnswered: boolean): boolean {
  if (!n8nIsAnswered) return false;
  const trimmed = answer.trim();
  if (!trimmed || trimmed.length < 10) return false;
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

export async function* callN8nStream(question: string, userId: number, userEmail: string): AsyncGenerator<string> {
  const res = await fetch(env.n8nWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, user_id: String(userId), user_email: userEmail }),
  });
  if (!res.ok) throw new Error(`n8n workflow error: ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body from n8n");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: !done });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const data = trimmed.startsWith("data: ") ? trimmed.slice(6) : trimmed;

      if (process.env.NODE_ENV !== "production") {
        console.log("[N8N_STREAM]", data.slice(0, 200));
      }

      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "item" && typeof parsed.content === "string") {
          yield parsed.content;
        }
        else if (parsed.type === "text" && typeof parsed.text === "string") {
          yield parsed.text;
        }
        else if (!parsed.type && !parsed.name && (
          typeof parsed.response === "string" ||
          typeof parsed.answer === "string" ||
          typeof parsed.content === "string" ||
          typeof parsed.output === "string"
        )) {
          yield parsed.response || parsed.answer || parsed.content || parsed.output;
        }
      } catch {
        // kalau bukan JSON (raw text), skip aja
      }
    }

    if (done) break;
  }
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
