import jwt from "jsonwebtoken";
import prisma from "../db.js";

export async function requireAuth(req, res, next) {
  const token = req.cookies?.access_token;
  if (!token) {
    return res.status(401).json({ error: "Sesi tidak ditemukan. Silakan login." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Akun tidak valid atau tidak aktif." });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Sesi tidak valid atau sudah berakhir." });
  }
}