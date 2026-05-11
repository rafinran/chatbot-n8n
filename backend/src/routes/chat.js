import { Router }               from "express";
import multer                   from "multer";
import { GoogleGenerativeAI }   from "@google/generative-ai";
import prisma                   from "../db.js";
import { requireAuth }          from "../middleware/auth.js";

const router  = Router();
const genAI   = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// In-memory session history per user
// Key: userId, Value: [{ role, content }]
const sessions = new Map();

function getSession(userId) {
  if (!sessions.has(userId)) sessions.set(userId, []);
  return sessions.get(userId);
}

async function logActivity(userId, action, extras = {}) {
  await prisma.activityLog.create({ data: { userId, action, ...extras } });
}


// POST /api/chat — kirim pesan teks ke n8n workflow
router.post("/", requireAuth, async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) {
    return res.status(400).json({ error: "Pesan tidak boleh kosong." });
  }

  try {
    const n8nRes = await fetch(`${process.env.N8N_WEBHOOK_URL}`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        question: message, 
        user_id: String(req.user.id),
        user_email: req.user.email,
      }),
    });

    if (!n8nRes.ok) throw new Error(`n8n workflow error: ${n8nRes.status}`);

    const n8nData = await n8nRes.json();
    const history = getSession(req.user.id);
    history.push({ role: "user",      content: message });
    history.push({ role: "assistant", content: n8nData.answer });
    if (history.length > 40) history.splice(0, 2);

    await logActivity(req.user.id, "chat", {
      question:   message.slice(0, 500),
      isAnswered: n8nData.is_answered,
    });

    res.json({ response: n8nData.answer, is_answered: n8nData.is_answered });
  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({ error: "Gagal mendapatkan respons dari n8n workflow." });
  }
});


// POST /api/chat/upload — kirim gambar untuk analisis Gemini Vision
router.post("/upload", requireAuth, upload.single("image"), async (req, res) => {
  const message = req.body.message || "Tolong analisis gambar ini.";

  if (!req.file) {
    return res.status(400).json({ error: "Tidak ada gambar yang diunggah." });
  }

  try {
    const model  = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: req.file.mimetype,
          data:     req.file.buffer.toString("base64"),
        },
      },
      `${message}\n\nAnalisis gambar ini secara detail. Jika ada defect atau masalah kualitas cetak, sebutkan: jenis masalah, lokasi pada gambar, tingkat keparahan, dan rekomendasi tindak lanjut.`,
    ]);

    const geminiResponse = result.response.text();

    // Kirim Hasil Analisis ke n8n (Webhook Kedua)
    let n8nStatus = "not_sent";
    if (process.env.N8N_WEBHOOK_URL_IMAGE) {
      try {
        const n8nRes = await fetch(process.env.N8N_WEBHOOK_URL_IMAGE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "image_analysis",
            user_id: String(req.user.id),
            user_email: req.user.email,
            analysis_result: geminiResponse,
            original_message: message,
            timestamp: new Date().toISOString()
          }),
        });
        if (n8nRes.ok) n8nStatus = "sent_to_n8n";
      } catch (webhookErr) {
        console.error("Gagal mengirim ke n8n vision webhook:", webhookErr.message);
      }
    }

    // Update Sesi Riwayat Chat (Memory)
    const history = getSession(req.user.id);
    history.push({ role: "user", content: `[Gambar] ${message}` });
    history.push({ role: "assistant", content: geminiResponse });

    // Simpan Log ke Database via Prisma
    await logActivity(req.user.id, "upload", {
      question: message.slice(0, 500),
      isAnswered: true,
      hasImage: true,
    });

    // Kirim Response ke Frontend
    res.json({ 
      response: geminiResponse,
      status: n8nStatus 
    });

  } catch (err) {
    console.error("Vision/n8n Error:", err.message);
    res.status(500).json({ error: "Gagal menganalisis gambar atau menghubungi sistem automasi." });
  }
});


// GET /api/chat/history — ambil history sesi aktif
router.get("/history", requireAuth, (req, res) => {
  res.json({ history: getSession(req.user.id) });
});


// DELETE /api/chat/history — reset percakapan
router.delete("/history", requireAuth, async (req, res) => {
  sessions.set(req.user.id, []);
  // Session history cleared from backend
  // n8n maintains its own session state if needed
  res.json({ message: "Percakapan direset." });
});

export default router;