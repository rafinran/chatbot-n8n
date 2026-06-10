import prisma from "../db.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OverviewStats {
  totalChat: number;
  answerRate: number;         // frontend: stats.answerRate
  unansweredCount: number;
  pendingEscalation: number;
  failedDocs: number;         // frontend: stats.failedDocs
}

export interface EscalationTicketData {
  id: number;
  user: string;
  username: string;
  question: string;
  hasImage: boolean;
  confidence: number | null;
  reason: string;
  status: string;
  date: string;
  time: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function last7DaysRange() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

// ── Overview Stats ────────────────────────────────────────────────────────────

export async function getOverviewStats(): Promise<OverviewStats> {
  const { start: todayStart, end: todayEnd } = todayRange();

  const [todayChats, pendingEscalations, failedDocs, unansweredToday] = await Promise.all([
    prisma.chatLog.findMany({
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
      select: { isAnswered: true },
    }),
    prisma.escalationTicket.count({ where: { status: "pending" } }),
    prisma.document.count({ where: { status: "failed" } }),
    prisma.chatLog.count({
      where: { isAnswered: false, createdAt: { gte: todayStart, lte: todayEnd } },
    }),
  ]);

  const totalChat = todayChats.length;
  const answeredCount = todayChats.filter((c) => c.isAnswered === true).length;
  const answerRate = totalChat > 0 ? Math.round((answeredCount / totalChat) * 100) : 0;

  return {
    totalChat,
    answerRate,
    unansweredCount: unansweredToday,
    pendingEscalation: pendingEscalations,
    failedDocs,
  };
}

// ── Chat Volume (7 hari terakhir) ─────────────────────────────────────────────
// Frontend: getChatVolume() → { volume: { date, count }[] }

export async function getChatVolume(): Promise<{ date: string; count: number }[]> {
  const { start: weekStart, end: weekEnd } = last7DaysRange();

  const weekChats = await prisma.chatLog.findMany({
    where: { createdAt: { gte: weekStart, lte: weekEnd } },
    select: { createdAt: true },
  });

  const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const volume: { date: string; count: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(weekEnd);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const count = weekChats.filter((c) => c.createdAt.toISOString().slice(0, 10) === ds).length;
    volume.push({ date: dayNames[d.getDay()], count });
  }

  return volume;
}

// ── Top Topics (unanswered 7 hari, grouped by question) ──────────────────────
// Frontend: getTopTopics() → { topics: { label, total }[] }

export async function getTopTopics(): Promise<{ label: string; total: number }[]> {
  const { start: weekStart, end: weekEnd } = last7DaysRange();

  const unanswered = await prisma.chatLog.findMany({
    where: { isAnswered: false, createdAt: { gte: weekStart, lte: weekEnd } },
    select: { question: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const freq: Record<string, number> = {};
  for (const log of unanswered) {
    const q = log.question?.slice(0, 80) || "(tanpa teks)";
    freq[q] = (freq[q] || 0) + 1;
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, total]) => ({ label, total }));
}

// ── Escalation Stats ──────────────────────────────────────────────────────────

export async function getEscalationStats() {
  const now = new Date();

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);

  const [pendingToday, resolvedWeek] = await Promise.all([
    prisma.escalationTicket.count({
      where: { status: "pending", createdAt: { gte: todayStart } },
    }),
    prisma.escalationTicket.count({
      where: { status: "resolved", createdAt: { gte: weekStart } },
    }),
  ]);

  return { pendingToday, resolvedWeek };
}

// ── Escalation Tickets ────────────────────────────────────────────────────────

export async function getEscalationTickets(
  status?: string,
  search?: string
): Promise<EscalationTicketData[]> {
  const tickets = await prisma.escalationTicket.findMany({
    where: {
      ...(status && status !== "all" ? { status } : {}),
      ...(search
        ? {
            OR: [
              { user: { fullName: { contains: search, mode: "insensitive" } } },
              { user: { username: { contains: search, mode: "insensitive" } } },
              { question: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      user: { select: { username: true, fullName: true } },
      chatLog: { select: { question: true, hasImage: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return tickets.map((t) => ({
    id:         t.id,
    user:       t.user.fullName,
    username:   `@${t.user.username}`,
    question:   t.chatLog?.question ?? t.question ?? "-",
    hasImage:   t.chatLog?.hasImage ?? false,
    confidence: t.confidence ?? null,
    reason:     t.reason,
    status:     t.status,
    date:       t.createdAt.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
    time:       t.createdAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
  }));
}

export async function resolveEscalation(id: number) {
  return prisma.escalationTicket.update({
    where: { id },
    data: { status: "resolved", resolvedAt: new Date() },
  });
}

// ── Auto-create escalation dari chat ─────────────────────────────────────────

export async function maybeEscalate(params: {
  chatLogId: number;
  userId: number;
  isAnswered: boolean;
  confidence?: number;
  question?: string;
}) {
  const { chatLogId, userId, isAnswered, confidence, question } = params;

  const isLowConfidence = confidence !== undefined && confidence < 0.4;
  const isNoContext     = !question || question.trim().length < 5;

  let reason: string | null = null;
  if (!isAnswered)          reason = "no_answer";
  else if (isLowConfidence) reason = "low_confidence";
  else if (isNoContext)     reason = "no_context";

  if (!reason) return;

  await prisma.escalationTicket.create({
    data: {
      chatLogId,
      userId,
      reason,
      confidence: confidence ?? null,
      status: "pending",
      question: (question ?? "").slice(0, 500),
    },
  });
}
