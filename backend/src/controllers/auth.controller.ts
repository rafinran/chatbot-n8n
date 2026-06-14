import type { Request, Response } from "express";
import * as authService from "../services/auth.service.ts";
import { RegisterSchema, LoginSchema } from "../dto/auth.dto.ts";
import { ForgotPasswordSchema, ResetPasswordSchema } from "../dto/password.dto.ts";
import { VerifyEmailSchema, ResendVerificationEmailSchema } from "../dto/email-verification.dto.ts";
import { asyncHandler } from "../utils/asyncHandler.ts";
import { logActivityLog } from "../middleware/activityLog.ts";
import prisma from "../db.ts";

export const register = asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    const messages = Object.values(parsed.error.flatten().fieldErrors)
      .flat()
      .join(", ");
    return res.status(400).json({ error: messages });
  }

  const { username, email, fullName, password } = parsed.data;
  const user = await authService.registerUser({ username, email, fullName, password }, req);

  res.status(201).json({
    message: "Registrasi berhasil. Silakan cek email untuk verifikasi.",
    user: { username: user.username, email: user.email },
  });
});

export const login = asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    const messages = Object.values(parsed.error.flatten().fieldErrors)
      .flat()
      .join(", ");
    return res.status(400).json({ error: messages });
  }

  const { username, password } = parsed.data;
  const user = await authService.loginUser({ username, password }, req);
  const token = authService.signToken(user.id, user.username);
  authService.setAuthCookie(res, token);

  res.json({ message: "Login berhasil.", user: authService.formatUser(user) });
});

export const logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await authService.logoutUser(req.user.id, req);
  res.clearCookie("access_token");
  res.json({ message: "Logout berhasil." });
});

export const me = asyncHandler((req: Request, res: Response): void => {
  res.json(authService.formatUser(req.user));
});

// ── Password Reset Controllers ────────────────────────────────────────────────

export const forgotPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = ForgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    const messages = Object.values(parsed.error.flatten().fieldErrors)
      .flat()
      .join(", ");
    res.status(400).json({ error: messages });
    return;
  }

  await authService.forgotPassword(parsed.data);
  // Always return success for security (don't reveal if email exists)
  res.json({ message: "Jika email terdaftar, link reset password telah dikirim." });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = ResetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    const messages = Object.values(parsed.error.flatten().fieldErrors)
      .flat()
      .join(", ");
    res.status(400).json({ error: messages });
    return;
  }

  await authService.resetPassword(parsed.data);
  // Log the activity with IP capture
  const resetToken = parsed.data.token;
  const tokenRecord = await prisma.passwordResetToken.findUnique({ where: { token: resetToken }, select: { userId: true } });
  if (tokenRecord) {
    await logActivityLog(tokenRecord.userId, "reset_password", req, true);
  }
  res.json({ message: "Password berhasil direset. Silakan login dengan password baru Anda." });
});

// ── Email Verification Controllers ────────────────────────────────────────────

export const verifyEmail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = VerifyEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    const messages = Object.values(parsed.error.flatten().fieldErrors)
      .flat()
      .join(", ");
    res.status(400).json({ error: messages });
    return;
  }

  const userId = await authService.verifyEmail(parsed.data);
  await logActivityLog(userId, "verify_email", req, true);
  res.json({ message: "Email berhasil diverifikasi. Anda sekarang dapat login." });
});

export const resendVerificationEmail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = ResendVerificationEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    const messages = Object.values(parsed.error.flatten().fieldErrors)
      .flat()
      .join(", ");
    res.status(400).json({ error: messages });
    return;
  }

  await authService.resendVerificationEmail(parsed.data);
  res.json({ message: "Email verifikasi berhasil dikirim ulang." });
});
