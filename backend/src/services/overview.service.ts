import prisma from "../db.ts";

// ── Overview Stats ────────────────────────────────────────────────────────────

export async function getOverviewStats() {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // Logs hari ini
  const todayLogs = await prisma.activityLog.findMany({
    where: { createdAt: { gte: todayStart } },
  });

  const totalChat    = todayLogs.length;
  const answered     = todayLogs.filter((l) => l.isAnswered === true).length;
  const answerRate   = totalChat > 0 ? Math.round((answered / totalChat) * 100) : 0;

  // Eskalasi pending
  const pendingEscalation = await (prisma.escalationTicket as any).count({
    where: { status: "pending" },
  });

  // Dokumen gagal
  const failedDocs = await prisma.document.count({
    where: { status: "failed" },
  });

  return {
    totalChat,
    answerRate,
    pendingEscalation,
    failedDocs,
  };
}

// ── Chat Volume 7 Hari ────────────────────────────────────────────────────────

export async function getChatVolume() {
  const days: { date: string; count: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const next = new Date(date);
    next.setDate(date.getDate() + 1);

    const count = await prisma.activityLog.count({
      where: { createdAt: { gte: date, lt: next } },
    });

    days.push({
      date: date.toLocaleDateString("id-ID", { weekday: "short", day: "numeric" }),
      count,
    });
  }

  return days;
}

// ── Top Topik ─────────────────────────────────────────────────────────────────

export async function getTopTopics() {
  // Ambil pertanyaan 7 hari terakhir yang terjawab
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const logs = await prisma.activityLog.findMany({
    where: {
      createdAt: { gte: since },
      question: { not: null },
      isAnswered: true,
    },
    select: { question: true },
    take: 200,
  });

  // Simple keyword grouping tanpa AI (cepat, tidak butuh API call)
  const topicKeywords: Record<string, string[]> = {
    "Kualitas Cetak":  ["cetak", "print", "buram", "blur", "warna", "color", "garis", "stripe"],
    "Masalah Tinta":   ["tinta", "ink", "cartridge", "isi", "refill", "kosong", "empty"],
    "Koneksi WiFi":    ["wifi", "wireless", "connect", "jaringan", "network", "koneksi"],
    "Paper Jam":       ["kertas", "paper", "jam", "macet", "nyangkut", "stuck"],
    "Install Driver":  ["driver", "install", "setup", "windows", "mac", "linux"],
    "Update Firmware": ["firmware", "update", "reset", "factory"],
    "Lainnya":         [],
  };

  const counts: Record<string, number> = {};
  const examples: Record<string, string[]> = {};

  for (const topic of Object.keys(topicKeywords)) {
    counts[topic] = 0;
    examples[topic] = [];
  }

  for (const log of logs) {
    const q = (log.question ?? "").toLowerCase();
    let matched = false;

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (topic === "Lainnya") continue;
      if (keywords.some((kw) => q.includes(kw))) {
        counts[topic]++;
        if (examples[topic].length < 2) examples[topic].push(log.question!);
        matched = true;
        break;
      }
    }

    if (!matched) {
      counts["Lainnya"]++;
      if (examples["Lainnya"].length < 2) examples["Lainnya"].push(log.question!);
    }
  }

  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, total]) => ({ label, total, examples: examples[label] }));
}

// ── Escalation ────────────────────────────────────────────────────────────────

export async function getEscalationStats() {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);

  const escalationModel = prisma.escalationTicket as any;
  const [pendingToday, resolvedWeek] = await Promise.all([
    escalationModel.count({
      where: { status: "pending", createdAt: { gte: todayStart } },
    }),
    escalationModel.count({
      where: { status: "resolved", createdAt: { gte: weekStart } },
    }),
  ]);

  return { pendingToday, resolvedWeek };
}

export async function getEscalationTickets(status?: string, search?: string) {
  const tickets = await (prisma.escalationTicket as any).findMany({
    where: {
      ...(status && status !== "all" ? { status } : {}),
      ...(search
        ? {
            OR: [
              { user: { fullName: { contains: search, mode: "insensitive" } } },
              { user: { username: { contains: search, mode: "insensitive" } } },
              { log: { question: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      user: { select: { username: true, fullName: true } },
      log:  { select: { question: true, hasImage: true, confidence: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (tickets as any[]).map((t: any) => {
    const log = t.log as { question: string | null; hasImage: boolean; confidence: number | null } | null;
    return {
      id:         t.id,
      user:       t.user.fullName,
      username:   `@${t.user.username}`,
      question:   log?.question ?? "-",
      hasImage:   log?.hasImage ?? false,
      confidence: log?.confidence ?? t.confidence ?? null,
      reason:     t.reason,
      status:     t.status,
      date:       t.createdAt.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
      time:       t.createdAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    };
  });
}

export async function resolveEscalation(id: number) {
  return (prisma.escalationTicket as any).update({
    where: { id },
    data: { status: "resolved", resolvedAt: new Date() },
  });
}

// ── Auto-create escalation dari chat ─────────────────────────────────────────
// Dipanggil dari chat.service saat isAnswered=false atau confidence rendah

export async function maybeEscalate(params: {
  logId: number;
  userId: number;
  isAnswered: boolean;
  confidence?: number;
  question?: string;
}) {
  const { logId, userId, isAnswered, confidence, question } = params;

  // Escalate jika:
  // 1. Tidak terjawab (isAnswered = false)
  // 2. Confidence rendah (< 0.4)
  // 3. Pertanyaan sangat pendek / tidak ada konteks (< 5 karakter)
  const isLowConfidence = confidence !== undefined && confidence < 0.4;
  const isNoContext     = !question || question.trim().length < 5;

  let reason: string | null = null;
  if (!isAnswered)       reason = "no_answer";
  else if (isLowConfidence) reason = "low_confidence";
  else if (isNoContext)  reason = "no_context";

  if (!reason) return; // tidak perlu eskalasi

  await (prisma.escalationTicket as any).create({
    data: { logId, userId, reason, confidence: confidence ?? null, status: "pending" },
  });
}
