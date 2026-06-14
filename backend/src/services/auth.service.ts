import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import prisma from "../db.ts";
import { env, COOKIE_MAX_AGE, JWT_EXPIRES_IN } from "../config/env.ts";
import type { RegisterDto, LoginDto, UserResponseDto } from "../dto/auth.dto.ts";
import type { ForgotPasswordDto, ResetPasswordDto } from "../dto/password.dto.ts";
import type { VerifyEmailDto, ResendVerificationEmailDto } from "../dto/email-verification.dto.ts";
import { sendEmail } from "./email.service.ts";
import { logActivityLog } from "../middleware/activityLog.ts";
import type { Response, Request } from "express";

export function setAuthCookie(res: Response, token: string): void {
  res.cookie("access_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    maxAge: COOKIE_MAX_AGE,
  });
}

export function signToken(userId: number, username: string): string {
  return jwt.sign({ userId, username }, env.jwtSecret, { expiresIn: JWT_EXPIRES_IN });
}

export function formatUser(user: any): UserResponseDto {
  return { username: user.username, fullName: user.fullName, email: user.email, role: user.role };
}

export async function registerUser(dto: RegisterDto, req: Request) {
  const { username, email, fullName, password } = dto;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });
  if (existing) throw { status: 400, message: "Username atau email sudah terdaftar." };

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { username, email, fullName, hashedPassword, isVerified: false },
  });

  await logActivityLog(user.id, "register", req, true);

  // Generate and send verification email
  try {
    await sendEmailVerification(user.id, user.email);
  } catch (err) {
    console.error("[AUTH] Failed to send verification email:", err);
    // Don't throw - let registration succeed even if email send fails
  }

  return user;
}

export async function loginUser(dto: LoginDto, req: Request) {
  const { username, password } = dto;

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await bcrypt.compare(password, user.hashedPassword))) {
    throw { status: 401, message: "Username atau password salah." };
  }
  if (!user.isActive) throw { status: 403, message: "Akun tidak aktif." };
  if (!user.isVerified) throw { status: 403, message: "Email belum diverifikasi. Silakan cek email Anda." };

  await logActivityLog(user.id, "login", req, true);
  return user;
}

export async function logoutUser(userId: number, req: Request): Promise<void> {
  await logActivityLog(userId, "logout", req, true);
}

// ── Password Reset Functions ──────────────────────────────────────────────────

export async function forgotPassword(dto: ForgotPasswordDto): Promise<void> {
  const { email } = dto;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // For security, don't reveal if email exists
    console.log(`[AUTH] Forgot password requested for non-existent email: ${email}`);
    return;
  }

  // Generate reset token
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt },
  });

  // Send reset email
  const resetLink = `${env.frontendUrl}/reset-password?token=${token}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #0A2A8B; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">Reset Password</h2>
      </div>
      
      <div style="padding: 20px; background-color: #f9f9f9; border: 1px solid #eee; border-radius: 0 0 8px 8px;">
        <p>Halo ${user.fullName},</p>
        
        <p>Kami menerima permintaan untuk mereset password akun Anda. Klik tombol di bawah untuk melanjutkan:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #0A2A8B; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
        </div>
        
        <p style="color: #666; font-size: 14px;">Link ini akan kadaluarsa dalam 1 jam. Jika Anda tidak meminta reset password, abaikan email ini.</p>
        
        <p style="color: #666; font-size: 14px;">Atau copy link ini ke browser Anda: <br/>${resetLink}</p>
        
        <p style="margin-top: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 15px;">
          © Epson Helpdesk | Powered by Chatson
        </p>
      </div>
    </div>
  `;

  await sendEmail({
    to: email,
    subject: "Reset Password - Epson Helpdesk",
    html,
  });
}

export async function resetPassword(dto: ResetPasswordDto): Promise<void> {
  const { token, newPassword } = dto;

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!resetToken) {
    throw { status: 400, message: "Token tidak valid." };
  }

  if (new Date() > resetToken.expiresAt) {
    throw { status: 400, message: "Token sudah kadaluarsa." };
  }

  if (resetToken.usedAt) {
    throw { status: 400, message: "Token sudah digunakan." };
  }

  // Update password
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: resetToken.userId },
    data: { hashedPassword },
  });

  // Mark token as used
  await prisma.passwordResetToken.update({
    where: { id: resetToken.id },
    data: { usedAt: new Date() },
  });

  // Note: reset_password doesn't have access to req here;
  // caller (controller) should log this if needed
}

// ── Email Verification Functions ──────────────────────────────────────────────

export async function sendEmailVerification(userId: number, email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  // Delete existing verification tokens
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });

  // Generate verification token
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await prisma.emailVerificationToken.create({
    data: { userId, token, expiresAt },
  });

  // Send verification email
  const verifyLink = `${env.frontendUrl}/verify-email?token=${token}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #0A2A8B; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">Verifikasi Email Anda</h2>
      </div>
      
      <div style="padding: 20px; background-color: #f9f9f9; border: 1px solid #eee; border-radius: 0 0 8px 8px;">
        <p>Halo ${user.fullName},</p>
        
        <p>Terima kasih telah mendaftar di Epson Helpdesk. Silakan verifikasi email Anda dengan mengklik tombol di bawah:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verifyLink}" style="background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Verifikasi Email</a>
        </div>
        
        <p style="color: #666; font-size: 14px;">Link ini akan kadaluarsa dalam 24 jam. Jika Anda tidak melakukan pendaftaran ini, abaikan email ini.</p>
        
        <p style="color: #666; font-size: 14px;">Atau copy link ini ke browser Anda: <br/>${verifyLink}</p>
        
        <p style="margin-top: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 15px;">
          © Epson Helpdesk | Powered by Chatson
        </p>
      </div>
    </div>
  `;

  await sendEmail({
    to: email,
    subject: "Verifikasi Email - Epson Helpdesk",
    html,
  });
}

export async function verifyEmail(dto: VerifyEmailDto): Promise<number> {
  const { token } = dto;

  const verificationToken = await prisma.emailVerificationToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!verificationToken) {
    throw { status: 400, message: "Token tidak valid." };
  }

  if (new Date() > verificationToken.expiresAt) {
    throw { status: 400, message: "Token sudah kadaluarsa." };
  }

  // Mark email as verified
  await prisma.user.update({
    where: { id: verificationToken.userId },
    data: { isVerified: true },
  });

  // Delete token
  await prisma.emailVerificationToken.deleteMany({ where: { userId: verificationToken.userId } });
  // Note: verify_email doesn't have access to req here;
  // caller (controller) should log this if needed
  return verificationToken.userId;
}

export async function resendVerificationEmail(dto: ResendVerificationEmailDto): Promise<void> {
  const { email } = dto;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw { status: 404, message: "User tidak ditemukan." };
  }

  if (user.isVerified) {
    throw { status: 400, message: "Email sudah diverifikasi." };
  }

  await sendEmailVerification(user.id, email);
}
