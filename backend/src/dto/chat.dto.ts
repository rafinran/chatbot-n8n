export interface SendMessageDto {
  message: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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
}
