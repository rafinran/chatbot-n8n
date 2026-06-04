import { z } from "zod";

export interface RegisterDto {
  username: string;
  email: string;
  fullName: string;
  password: string;
}

export interface LoginDto {
  username: string;
  password: string;
}

export interface UserResponseDto {
  username: string;
  fullName: string;
  email: string;
  role: string;
}

export const RegisterSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, "Username hanya boleh huruf, angka, dan underscore"),
  email:    z.string().email("Format email tidak valid"),
  fullName: z.string().min(2).max(100),
  password: z.string().min(8, "Password minimal 8 karakter")
    .regex(/^(?=.*[A-Z])(?=.*[0-9])/, "Password minimal 1 huruf besar dan 1 angka"),
});

export const LoginSchema = z.object({
  username: z.string().min(1, "Username wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
});
