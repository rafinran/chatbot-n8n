import { env } from "../config/env.ts";
import prisma from "../db.ts";

const CLASSIFICATION_TIMEOUT = 10 * 1000;

/**
 * Classifies if a question is about Epson printers/ink or not
 * Returns true if question is relevant (about Epson), false if off-topic
 */
export async function classifyQuestion(question: string): Promise<boolean> {
  try {
    const prompt = `You are a classification assistant. Your task is to determine if a question is about Epson printers, ink, supplies, or related support topics.

Question: "${question}"

Answer with ONLY one word: "yes" if the question is about Epson printers/ink/supplies/support, or "no" if it's completely off-topic.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CLASSIFICATION_TIMEOUT);

    try {
      const res = await fetch("https://api.opencode.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.opencodeApiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-v4-flash",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 5,
          temperature: 0,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`OpenCode error: ${res.status}`);
      const data = await res.json() as any;
      const response = data.choices?.[0]?.message?.content?.toLowerCase()?.trim() ?? "";
      const isRelevant = response.includes("yes");

      console.log(`[CLASSIFIER] Question: "${question.slice(0, 50)}..." | Result: ${isRelevant ? "relevant" : "off-topic"}`);
      return isRelevant;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  } catch (err) {
    console.error("[CLASSIFIER] Error during classification:", err);
    return true; // On error, assume relevant to avoid blocking legitimate questions
  }
}

/**
 * Logs off-topic classification to activity log
 */
export async function logOffTopic(userId: number, question: string): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action: "off_topic",
        metadata: {
          question: question.slice(0, 500),
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (err) {
    console.error("[CLASSIFIER] Failed to log off-topic:", err);
  }
}
