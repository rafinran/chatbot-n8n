import { z } from "zod";

export interface SendMessageDto {
  message: string;
  conversationId?: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
}

export interface N8nRequestDto {
  question: string;
  user_id: string;
  user_email: string;
}

export interface N8nResponseDto {
  answer: string;
  is_answered: boolean;
}

export interface ChatResponseDto {
  response: string;
  is_answered: boolean;
  conversationId: number;
  imageUrl?: string;
}

export const SendMessageSchema = z.object({
  message: z.string().min(1, "Pesan tidak boleh kosong").max(5000, "Pesan maksimal 5000 karakter"),
  conversationId: z.number().int().positive().optional(),
});
