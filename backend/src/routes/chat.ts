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

// Hapus file upload lama (> 1 jam) saat server start
function cleanOldUploads(): void {
  const ONE_HOUR = 60 * 60 * 1000;
  try {
    const files = fs.readdirSync(UPLOAD_DIR);
    files.forEach((file) => {
      const filePath = path.join(UPLOAD_DIR, file);
      const stat = fs.statSync(filePath);
      if (Date.now() - stat.mtimeMs > ONE_HOUR) {
        fs.unlinkSync(filePath);
        console.log("[CLEANUP] Hapus file lama:", file);
      }
    });
  } catch (err: any) {
    console.warn("[CLEANUP] Gagal bersihkan uploads:", err.message);
  }
}
cleanOldUploads();

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

function sessionId(userId: number): string {
  return `user_${userId}`;
}

async function getSession(userId: number): Promise<ChatMessage[]> {
  const rows = await prisma.n8n_chat_histories.findMany({
    where: { session_id: sessionId(userId) },
    orderBy: { id: "asc" },
  });

  return rows.flatMap((row) => {
    const msg = row.message as any;
    const role: "user" | "assistant" =
      msg?.data?.type === "human" ? "user" : "assistant";
    const content: string = msg?.data?.content ?? "";
    return content ? [{ role, content }] : [];
  });
}

async function appendSession(
  userId: number,
  userContent: string,
  assistantContent: string
): Promise<void> {
  const sid = sessionId(userId);
  await prisma.n8n_chat_histories.createMany({
    data: [
      {
        session_id: sid,
        message: { type: "human", data: { type: "human", content: userContent } },
      },
      {
        session_id: sid,
        message: { type: "ai", data: { type: "ai", content: assistantContent } },
      },
    ],
  });

  const allRows = await prisma.n8n_chat_histories.findMany({
    where: { session_id: sid },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (allRows.length > 40) {
    const toDelete = allRows.slice(0, allRows.length - 40).map((r) => r.id);
    await prisma.n8n_chat_histories.deleteMany({ where: { id: { in: toDelete } } });
  }
}

async function clearSession(userId: number): Promise<void> {
  await prisma.n8n_chat_histories.deleteMany({
    where: { session_id: sessionId(userId) },
  });
}

async function logActivity(userId: number, action: string, extras: Record<string, any> = {}): Promise<void> {
  await prisma.activityLog.create({ data: { userId, action, ...extras } });
}

// POST /api/chat — kirim pesan (teks saja atau teks + gambar)
router.post("/", requireAuth, upload.single("image"), async (req: Request, res: Response): Promise<any> => {
  const message = req.body.message?.trim();

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
      console.log("[CHAT] Gambar diterima, mulai analisis...");

      const fileBuffer = fs.readFileSync(req.file.path);
      const base64 = fileBuffer.toString("base64");
      const promptText = `${message}\n\nAnalisis gambar ini secara detail. Jika ada defect atau masalah kualitas cetak, sebutkan: jenis masalah, lokasi pada gambar, tingkat keparahan, dan rekomendasi tindak lanjut.`;

      let imageAnalysis = "";

      try {
        console.log("[CHAT] Mencoba analisis dengan Gemini Cloud...");
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent([
          { inlineData: { mimeType: req.file.mimetype, data: base64 } }, promptText,
        ]);

        imageAnalysis = result.response.text();
        console.log("[CHAT] Hasil analisis Gemini:", imageAnalysis.slice(0, 200), "...");

      } catch (cloudError: any) {
        console.warn("[CHAT] High demand, ganti ke ollama");

        try {
          const ollamaRes = await fetch("http://ollama:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gemma3:4b",
              prompt: promptText,
              image: [base64],
              stream: false,
            }),
          });

          if (!ollamaRes.ok) throw new Error(`Ollama local gagal: ${ollamaRes.status}`);

          const ollamaData = await ollamaRes.json() as any;
          imageAnalysis = ollamaData.response;
          console.log("[CHAT] Sukses menggunakan Ollama Lokal.");

        } catch (localError: any) {
          console.error("[CHAT] Kedua metode analisis gambar gagal total.");
          throw new Error("Sistem analisis gambar sedang tidak tersedia.");
        }
      }

      console.log("[CHAT] Hasil analisis akhir:", imageAnalysis.slice(0, 200), "...");
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

    const userContent = req.file ? `[Gambar] ${message}` : message;
    await appendSession(req.user.id, userContent, n8nData.answer);

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
  } finally {
    // Hapus file upload setelah selesai diproses (berhasil atau gagal)
    if (req.file?.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.warn("[CLEANUP] Gagal hapus file:", err.message);
        else console.log("[CLEANUP] File dihapus:", req.file!.filename);
      });
    }
  }
});

// GET /api/chat/history — ambil history sesi aktif dari PostgreSQL
router.get("/history", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const history = await getSession(req.user.id);
  res.json({ history });
});

// DELETE /api/chat/history — reset percakapan
router.delete("/history", requireAuth, async (req: Request, res: Response): Promise<void> => {
  await clearSession(req.user.id);
  res.json({ message: "Percakapan direset." });
});

export default router;
