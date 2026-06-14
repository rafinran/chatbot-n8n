import { z } from "zod";

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

export const ForgotPasswordSchema = z.object({
  email: z.string().email("Format email tidak valid"),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, "Token wajib diisi"),
  newPassword: z.string().min(8, "Password minimal 8 karakter")
    .regex(/^(?=.*[A-Z])(?=.*[0-9])/, "Password minimal 1 huruf besar dan 1 angka"),
});
