import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "../db.ts";
import { requireAuth } from "../middleware/auth.ts";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

// Simpan gambar ke disk di folder uploads/
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const sessions = new Map<number, ChatMessage[]>();

function getSession(userId: number): ChatMessage[] {
  if (!sessions.has(userId)) sessions.set(userId, []);
  return sessions.get(userId)!;
}

async function logActivity(userId: number, action: string, extras: Record<string, any> = {}): Promise<void> {
  await prisma.activityLog.create({ data: { userId, action, ...extras } });
}

// POST /api/chat — kirim pesan (teks saja atau teks + gambar)
router.post("/", requireAuth, upload.single("image"), async (req: Request, res: Response): Promise<any> => {
  const message = req.body.message?.trim();

  // Debug log — cek apa yang diterima backend
  console.log("[CHAT] body:", req.body);
  console.log("[CHAT] file:", req.file
    ? { filename: req.file.filename, mimetype: req.file.mimetype, size: req.file.size, path: req.file.path }
    : "tidak ada file"
  );

  if (!message) {
    return res.status(400).json({ error: "Pesan tidak boleh kosong." });
  }

  try {
    let question = message;

    // Kalau ada gambar, analisis dulu pakai Gemini Vision
    if (req.file) {
      console.log("[CHAT] Gambar diterima, mulai analisis Gemini...");

      const fileBuffer = fs.readFileSync(req.file.path);
      const base64 = fileBuffer.toString("base64");

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: req.file.mimetype,
            data: base64,
          },
        },
        `${message}\n\nAnalisis gambar ini secara detail. Jika ada defect atau masalah kualitas cetak, sebutkan: jenis masalah, lokasi pada gambar, tingkat keparahan, dan rekomendasi tindak lanjut.`,
      ]);

      const imageAnalysis = result.response.text();
      console.log("[CHAT] Hasil analisis Gemini:", imageAnalysis.slice(0, 200), "...");

      // Gabungkan pesan user + hasil analisis gambar jadi satu question
      question = `${message}\n\n[Hasil analisis gambar]:\n${imageAnalysis}`;
    }

    // Kirim ke n8n
    console.log("[CHAT] Kirim ke n8n, question length:", question.length);
    const n8nRes = await fetch(process.env.N8N_WEBHOOK_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        user_id: String(req.user.id),
        user_email: req.user.email,
      }),
    });

    if (!n8nRes.ok) throw new Error(`n8n workflow error: ${n8nRes.status}`);

    const n8nData = await n8nRes.json() as any;
    console.log("[CHAT] Response n8n:", n8nData);

    // Simpan ke session memory
    const history = getSession(req.user.id);
    history.push({ role: "user", content: req.file ? `[Gambar] ${message}` : message });
    history.push({ role: "assistant", content: n8nData.answer });
    if (history.length > 40) history.splice(0, 2);

    // Log aktivitas
    await logActivity(req.user.id, req.file ? "upload" : "chat", {
      question: message.slice(0, 500),
      isAnswered: n8nData.is_answered,
      hasImage: !!req.file,
      ...(req.file && { imagePath: req.file.filename }),
    });

    res.json({ response: n8nData.answer, is_answered: n8nData.is_answered });
  } catch (err: any) {
    console.error("[CHAT] Error:", err.message);
    res.status(500).json({ error: "Gagal mendapatkan respons." });
  }
});

// GET /api/chat/history — ambil history sesi aktif
router.get("/history", requireAuth, (req: Request, res: Response): void => {
  res.json({ history: getSession(req.user.id) });
});

// DELETE /api/chat/history — reset percakapan
router.delete("/history", requireAuth, async (req: Request, res: Response): Promise<void> => {
  sessions.set(req.user.id, []);
  res.json({ message: "Percakapan direset." });
});

export default router;
