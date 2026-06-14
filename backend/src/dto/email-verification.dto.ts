import { z } from "zod";

export interface VerifyEmailDto {
  token: string;
}

export interface ResendVerificationEmailDto {
  email: string;
}

export const VerifyEmailSchema = z.object({
  token: z.string().min(1, "Token wajib diisi"),
});

export const ResendVerificationEmailSchema = z.object({
  email: z.string().email("Format email tidak valid"),
});
