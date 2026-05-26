import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../db.ts";
import { requireAuth } from "../middleware/auth.ts";

const router = Router();
const COOKIE_MAX_AGE = 8 * 60 * 60 * 1000; // 8 jam

function setAuthCookie(res: Response, token: string): void {
  res.cookie("access_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
  });
}

router.post("/register", async (req: Request, res: Response): Promise<any> => {
  const { username, email, fullName, password } = req.body;

  if (!username || !email || !fullName || !password) {
    return res.status(400).json({ error: "Semua field wajib diisi." });
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });

  if (existing) {
    return res.status(400).json({ error: "Username atau email sudah terdaftar." });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await prisma.user.create({ data: { username, email, fullName, hashedPassword } });

  res.status(201).json({ message: "Registrasi berhasil." });
});

router.post("/login", async (req: Request, res: Response): Promise<any> => {
  const { username, password } = req.body;

  const user = await prisma.user.findUnique({ where: { username } });

  if (!user || !(await bcrypt.compare(password, user.hashedPassword))) {
    return res.status(401).json({ error: "Username atau password salah." });
  }

  if (!user.isActive) {
    return res.status(403).json({ error: "Akun tidak aktif." });
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username },
    process.env.JWT_SECRET!,
    { expiresIn: "8h" }
  );

  setAuthCookie(res, token);
  await prisma.activityLog.create({ data: { userId: user.id, action: "login" } });

  res.json({
    message: "Login berhasil.",
    user: { username: user.username, fullName: user.fullName, email: user.email },
  });
});

router.post("/logout", requireAuth, async (req: Request, res: Response): Promise<any> => {
  await prisma.activityLog.create({ data: { userId: req.user.id, action: "logout" } });
  res.clearCookie("access_token");
  res.json({ message: "Logout berhasil." });
});

router.get("/me", requireAuth, (req: Request, res: Response): void => {
  const { username, fullName, email } = req.user;
  res.json({ username, fullName, email });
});

export default router;
