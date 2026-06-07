import { Resend } from "resend";
import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "../db.ts";
import { env } from "../config/env.ts";

// ── Types ──────────────────────────────────────────────────────────────────

interface ReportRange {
  label: string;       // "Minggu ini" / "Hari ini"
  from: Date;
  to: Date;
}

interface ClusterResult {
  clusters: { topic: string; count: number; examples: string[] }[];
  narrative: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getRange(type: "daily" | "weekly"): ReportRange {
  const now = new Date();
  const to = new Date(now);

  if (type === "daily") {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    return { label: "Hari ini", from, to };
  }

  // weekly: Senin s/d hari ini
  const from = new Date(now);
  from.setDate(now.getDate() - now.getDay() + 1); // Senin
  from.setHours(0, 0, 0, 0);
  return { label: "Minggu ini", from, to };
}

// ── Step 1: Query data dari Postgres ──────────────────────────────────────

async function queryReportData(from: Date, to: Date) {
  const logs = await prisma.activityLog.findMany({
    where: {
      action: "chat",
      createdAt: { gte: from, lte: to },
    },
    include: {
      user: { select: { username: true, fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalChats = logs.length;
  const answeredChats = logs.filter((l) => l.isAnswered === true).length;
  const unansweredChats = logs.filter((l) => l.isAnswered === false).length;
  const chatsWithImage = logs.filter((l) => l.hasImage).length;

  // Hitung user paling aktif
  const userCount: Record<string, { fullName: string; count: number }> = {};
  for (const log of logs) {
    const key = log.user.username;
    if (!userCount[key]) userCount[key] = { fullName: log.user.fullName, count: 0 };
    userCount[key].count++;
  }
  const topUsers = Object.entries(userCount)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([username, v]) => ({ username, fullName: v.fullName, count: v.count }));

  // Pertanyaan yang tidak terjawab (untuk analisis gap FAQ)
  const unansweredQuestions = logs
    .filter((l) => l.isAnswered === false && l.question)
    .map((l) => l.question as string)
    .slice(0, 50); // max 50 untuk dikirim ke Gemini

  // Semua pertanyaan untuk clustering
  const allQuestions = logs
    .filter((l) => l.question)
    .map((l) => l.question as string)
    .slice(0, 100);

  return {
    totalChats,
    answeredChats,
    unansweredChats,
    chatsWithImage,
    topUsers,
    allQuestions,
    unansweredQuestions,
  };
}

// ── Step 2: AI Clustering via Gemini ──────────────────────────────────────

async function clusterWithGemini(questions: string[]): Promise<ClusterResult> {
  if (questions.length === 0) {
    return {
      clusters: [],
      narrative: "Tidak ada pertanyaan yang masuk pada periode ini.",
    };
  }

  const genAI = new GoogleGenerativeAI(env.googleApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
  const prompt = `Kamu adalah analis data helpdesk. Berikut adalah daftar pertanyaan yang masuk ke chatbot helpdesk Epson:

${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Tugasmu:
1. Kelompokkan pertanyaan-pertanyaan di atas menjadi 3-7 topik/kategori utama.
2. Hitung berapa banyak pertanyaan per kategori.
3. Berikan 2-3 contoh pertanyaan representatif per kategori.
4. Tulis narasi singkat (2-3 kalimat) tentang tren pertanyaan yang paling menonjol.

Balas HANYA dalam format JSON berikut, tanpa penjelasan tambahan:
{
  "clusters": [
    {
      "topic": "nama kategori",
      "count": jumlah,
      "examples": ["contoh 1", "contoh 2"]
    }
  ],
  "narrative": "narasi singkat di sini"
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, "").trim();
    return JSON.parse(text) as ClusterResult;
  } catch (err) {
    console.warn("[REPORT] Gemini clustering failed, using fallback:", err);
    return {
      clusters: [{ topic: "Pertanyaan Umum", count: questions.length, examples: questions.slice(0, 3) }],
      narrative: "Analisis AI tidak tersedia saat ini.",
    };
  }
}

// ── Step 3: Build HTML Email ───────────────────────────────────────────────

function buildEmailHtml(params: {
  range: ReportRange;
  totalChats: number;
  answeredChats: number;
  unansweredChats: number;
  chatsWithImage: number;
  topUsers: { fullName: string; count: number }[];
  clustering: ClusterResult;
  unansweredClustering: ClusterResult;
}): string {
  const {
    range, totalChats, answeredChats, unansweredChats,
    chatsWithImage, topUsers, clustering, unansweredClustering,
  } = params;

  const answerRate = totalChats > 0 ? Math.round((answeredChats / totalChats) * 100) : 0;
  const fromStr = range.from.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const toStr = range.to.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  const clusterRows = clustering.clusters.map((c) => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;">${c.topic}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:600;">${c.count}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;color:#666;font-size:13px;">${c.examples.slice(0, 2).join(" • ")}</td>
    </tr>`).join("");

  const unansweredRows = unansweredClustering.clusters.map((c) => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;">${c.topic}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:600;color:#e53e3e;">${c.count}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;color:#666;font-size:13px;">${c.examples.slice(0, 2).join(" • ")}</td>
    </tr>`).join("");

  const topUserRows = topUsers.map((u, i) => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;">${i + 1}. ${u.fullName}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:600;">${u.count} chat</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f8fc;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:680px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#003087 0%,#0066cc 100%);padding:32px 40px;">
      <div style="color:#fff;font-size:13px;opacity:0.8;margin-bottom:4px;">EPSON HELPDESK AI</div>
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">Laporan Analisis ${range.label}</h1>
      <div style="color:#a8c8f0;font-size:13px;margin-top:8px;">${fromStr} — ${toStr}</div>
    </div>

    <!-- Stats -->
    <div style="padding:32px 40px 16px;">
      <h2 style="margin:0 0 20px;font-size:16px;color:#333;font-weight:600;">Ringkasan Aktivitas</h2>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;">
        <div style="background:#f0f7ff;border-radius:8px;padding:20px;text-align:center;">
          <div style="font-size:36px;font-weight:700;color:#003087;">${totalChats}</div>
          <div style="font-size:13px;color:#666;margin-top:4px;">Total Chat</div>
        </div>
        <div style="background:#f0fff4;border-radius:8px;padding:20px;text-align:center;">
          <div style="font-size:36px;font-weight:700;color:#276749;">${answerRate}%</div>
          <div style="font-size:13px;color:#666;margin-top:4px;">Tingkat Terjawab</div>
        </div>
        <div style="background:#fffaf0;border-radius:8px;padding:20px;text-align:center;">
          <div style="font-size:36px;font-weight:700;color:#c05621;">${unansweredChats}</div>
          <div style="font-size:13px;color:#666;margin-top:4px;">Tidak Terjawab</div>
        </div>
        <div style="background:#faf5ff;border-radius:8px;padding:20px;text-align:center;">
          <div style="font-size:36px;font-weight:700;color:#553c9a;">${chatsWithImage}</div>
          <div style="font-size:13px;color:#666;margin-top:4px;">Chat dengan Gambar</div>
        </div>
      </div>
    </div>

    <!-- AI Narrative -->
    ${clustering.narrative ? `
    <div style="margin:16px 40px;background:#f0f7ff;border-left:4px solid #003087;border-radius:0 8px 8px 0;padding:16px 20px;">
      <div style="font-size:12px;font-weight:600;color:#003087;margin-bottom:6px;">✦ ANALISIS AI</div>
      <p style="margin:0;color:#333;font-size:14px;line-height:1.6;">${clustering.narrative}</p>
    </div>` : ""}

    <!-- Topic Clustering -->
    <div style="padding:16px 40px;">
      <h2 style="margin:0 0 16px;font-size:16px;color:#333;font-weight:600;">Topik Pertanyaan Terbanyak</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f7f8fc;">
            <th style="padding:10px 16px;text-align:left;color:#666;font-weight:600;">Topik</th>
            <th style="padding:10px 16px;text-align:center;color:#666;font-weight:600;">Jumlah</th>
            <th style="padding:10px 16px;text-align:left;color:#666;font-weight:600;">Contoh</th>
          </tr>
        </thead>
        <tbody>${clusterRows || '<tr><td colspan="3" style="padding:16px;text-align:center;color:#999;">Tidak ada data</td></tr>'}</tbody>
      </table>
    </div>

    <!-- Unanswered Gap Analysis -->
    ${unansweredChats > 0 ? `
    <div style="padding:16px 40px;">
      <h2 style="margin:0 0 8px;font-size:16px;color:#333;font-weight:600;">Gap FAQ — Pertanyaan Tidak Terjawab</h2>
      <p style="margin:0 0 16px;font-size:13px;color:#666;">Topik berikut belum tercakup dalam knowledge base dan perlu ditambahkan.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#fff5f5;">
            <th style="padding:10px 16px;text-align:left;color:#666;font-weight:600;">Topik</th>
            <th style="padding:10px 16px;text-align:center;color:#666;font-weight:600;">Jumlah</th>
            <th style="padding:10px 16px;text-align:left;color:#666;font-weight:600;">Contoh</th>
          </tr>
        </thead>
        <tbody>${unansweredRows}</tbody>
      </table>
    </div>` : ""}

    <!-- Top Users -->
    ${topUsers.length > 0 ? `
    <div style="padding:16px 40px;">
      <h2 style="margin:0 0 16px;font-size:16px;color:#333;font-weight:600;">Pengguna Paling Aktif</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tbody>${topUserRows}</tbody>
      </table>
    </div>` : ""}

    <!-- Footer -->
    <div style="background:#f7f8fc;padding:24px 40px;margin-top:16px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#999;">Laporan ini dibuat otomatis oleh Epson Helpdesk AI System</p>
      <p style="margin:4px 0 0;font-size:12px;color:#999;">Dikirim pada ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB</p>
    </div>

  </div>
</body>
</html>`;
}

// ── Step 4: Send Email via Gmail SMTP ─────────────────────────────────────

async function sendEmail(subject: string, html: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: env.gmailUser,
      pass: env.gmailAppPassword,
    },
  });

  await transporter.sendMail({
    from: `"Epson Helpdesk AI" <${env.gmailUser}>`,
    to: env.reportRecipient,
    subject,
    html,
  });
}

// ── Main: Generate & Send Report ──────────────────────────────────────────

export async function generateAndSendReport(type: "daily" | "weekly"): Promise<{ message: string }> {
  const range = getRange(type);

  // 1. Query data
  const data = await queryReportData(range.from, range.to);

  // 2. AI clustering (parallel untuk hemat waktu)
  const [clustering, unansweredClustering] = await Promise.all([
    clusterWithGemini(data.allQuestions),
    clusterWithGemini(data.unansweredQuestions),
  ]);

  // 3. Build HTML
  const html = buildEmailHtml({
    range,
    totalChats: data.totalChats,
    answeredChats: data.answeredChats,
    unansweredChats: data.unansweredChats,
    chatsWithImage: data.chatsWithImage,
    topUsers: data.topUsers,
    clustering,
    unansweredClustering,
  });

  // 4. Kirim email
  const subject = `[Epson Helpdesk] Laporan ${range.label} — ${range.from.toLocaleDateString("id-ID")}`;
  await sendEmail(subject, html);

  return { message: `Laporan ${range.label} berhasil dikirim ke ${env.reportRecipient}` };
}
