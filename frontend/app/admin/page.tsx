"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Upload,
  FileText,
  Trash2,
  LogOut,
  CheckCircle,
  XCircle,
  Loader2,
  Database,
  ShieldCheck,
  RefreshCw,
  FileSpreadsheet,
  File,
  RotateCcw,
  Users,
  UserCheck,
  BarChart2,
  Send,
  CalendarDays,
  CalendarRange,
  Mail,
  Home,
  AlertTriangle,
  Clock3,
  MessageCircle,
  Eye,
  Search,
  Filter,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  getDocuments,
  uploadDocument,
  deleteDocument,
  reindexDocument,
  getUsers,
  toggleUserStatus,
  updateUserRole,
  sendReport,
  getOverviewStats,
  getChatVolume,
  getTopTopics,
  getEscalationStats,
  getEscalations,
  deleteUser,
  replyEscalation,
} from "@/lib/api";

interface Document {
  id: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: "processing" | "indexed" | "failed";
  errorMessage?: string;
  createdAt: string;
  uploadedBy: { username: string; fullName: string };
}

interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: "USER" | "ADMIN";
  isActive: boolean;
  createdAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv"))
    return <FileSpreadsheet size={15} className="text-[#0A2A8B]" />;
  if (mimeType.includes("pdf")) return <FileText size={15} className="text-[#0A2A8B]" />;
  return <File size={15} className="text-[#0A2A8B]" />;
}

function StatusBadge({ status }: { status: Document["status"] }) {
  const map = {
    processing: { icon: <Loader2 size={11} className="animate-spin" />, label: "Memproses", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    indexed:    { icon: <CheckCircle size={11} />,                       label: "Terindeks",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    failed:     { icon: <XCircle size={11} />,                           label: "Gagal",      cls: "bg-red-50 text-red-600 border-red-200" },
  };
  const { icon, label, cls } = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border font-medium ${cls}`}>
      {icon} {label}
    </span>
  );
}

// ── Report Tab ─────────────────────────────────────────────────────────────

function ReportTab() {
  const [sending, setSending] = useState<"daily" | "weekly" | null>(null);
  const [lastSent, setLastSent] = useState<{ type: string; time: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSend = async (type: "daily" | "weekly") => {
    setSending(type);
    try {
      const data = await sendReport(type);
      showToast(data.message || "Laporan berhasil dikirim.", "success");
      setLastSent({ type: type === "daily" ? "Harian" : "Mingguan", time: new Date().toLocaleTimeString("id-ID") });
    } catch (e: any) {
      showToast(e.message || "Gagal mengirim laporan.", "error");
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium border
          ${toast.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-red-50 border-red-200 text-red-600"}`}>
          {toast.type === "success" ? <CheckCircle size={15} /> : <XCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Header info */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 flex items-start gap-3">
        <Mail size={16} className="text-[#0A2A8B] mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-[#0A2A8B]">Kirim Laporan via Email</p>
          <p className="text-xs text-blue-600 mt-0.5">
            Laporan berisi ringkasan aktivitas chat, topik yang sering ditanyakan, analisis gap FAQ, dan user paling aktif.
            Dikirim via Gmail ke email atasan yang dikonfigurasi di server.
          </p>
        </div>
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Daily */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
              <CalendarDays size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Laporan Harian</p>
              <p className="text-xs text-gray-400 mt-0.5">Aktivitas hari ini (00:00 – sekarang)</p>
            </div>
          </div>

          <ul className="space-y-1.5 text-xs text-gray-500">
            {["Total & % chat terjawab hari ini", "Topik pertanyaan terbanyak", "Pertanyaan tidak terjawab (gap FAQ)", "User paling aktif"].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-amber-400 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>

          <button
            onClick={() => handleSend("daily")}
            disabled={sending !== null}
            className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending === "daily" ? (
              <><Loader2 size={14} className="animate-spin" /> Mengirim...</>
            ) : (
              <><Send size={14} /> Kirim Laporan Harian</>
            )}
          </button>
        </div>

        {/* Weekly */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0A2A8B]/10 border border-[#0A2A8B]/10 flex items-center justify-center">
              <CalendarRange size={18} className="text-[#0A2A8B]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Laporan Mingguan</p>
              <p className="text-xs text-gray-400 mt-0.5">Aktivitas minggu ini (Senin – sekarang)</p>
            </div>
          </div>

          <ul className="space-y-1.5 text-xs text-gray-500">
            {["Total & % chat terjawab minggu ini", "Clustering topik via AI", "Analisis gap FAQ dengan AI", "5 user paling aktif minggu ini"].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-[#0A2A8B] flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>

          <button
            onClick={() => handleSend("weekly")}
            disabled={sending !== null}
            className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-[#0A2A8B] hover:bg-[#0c35b0] text-white text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending === "weekly" ? (
              <><Loader2 size={14} className="animate-spin" /> Mengirim...</>
            ) : (
              <><Send size={14} /> Kirim Laporan Mingguan</>
            )}
          </button>
        </div>
      </div>

      {/* Last sent info */}
      {lastSent && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <CheckCircle size={12} className="text-emerald-500" />
          Laporan {lastSent.type} terakhir dikirim pukul {lastSent.time}
        </div>
      )}

      {/* Note */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 px-5 py-4">
        <p className="text-xs font-semibold text-gray-600 mb-2">Catatan Konfigurasi</p>
        <ul className="space-y-1 text-xs text-gray-400">
          <li>• Email tujuan dikonfigurasi via env var <code className="bg-gray-100 px-1 rounded">REPORT_RECIPIENT</code> di server</li>
          <li>• Pastikan <code className="bg-gray-100 px-1 rounded">GMAIL_USER</code> dan <code className="bg-gray-100 px-1 rounded">GMAIL_APP_PASSWORD</code> sudah diset</li>
          <li>• Proses pengiriman bisa memakan waktu 10–30 detik karena analisis AI</li>
        </ul>
      </div>
    </div>
  );
}

function OverviewTab() {
  const [stats, setStats] = useState<any>(null);
  const [volume, setVolume] = useState<{ date: string; count: number }[]>([]);
  const [topics, setTopics] = useState<{ label: string; total: number }[]>([]);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [updatedAt, setUpdatedAt] = useState("");

  const fetchOverview = async () => {
    setLoadingOverview(true);
    try {
      const [s, v, t] = await Promise.all([
        getOverviewStats(),
        getChatVolume(),
        getTopTopics(),
      ]);
      setStats(s);
      setVolume(v.volume ?? []);
      setTopics(t.topics ?? []);
      setUpdatedAt(new Date().toLocaleString("id-ID"));
    } catch {
      // silently ignore
    } finally {
      setLoadingOverview(false);
    }
  };

  useEffect(() => { fetchOverview(); }, []);

  const maxVol = Math.max(...volume.map((v) => v.count), 1);
  const maxTopic = Math.max(...topics.map((t) => t.total), 1);

  if (loadingOverview) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-[#0A2A8B]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Overview</h2>
          <p className="text-sm text-gray-400">Terakhir diperbarui: {updatedAt}</p>
        </div>
        <button
          onClick={fetchOverview}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* KPI */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <MessageCircle size={14} /> Total Chat Hari Ini
          </div>
          <div className="text-4xl font-bold text-blue-600 mt-2">{stats?.totalChat ?? 0}</div>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <CheckCircle size={14} /> Chat Terjawab
          </div>
          <div className="text-4xl font-bold text-green-600 mt-2">{stats?.answerRate ?? 0}%</div>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <AlertTriangle size={14} /> Eskalasi Pending
          </div>
          <div className="text-4xl font-bold text-red-500 mt-2">{stats?.pendingEscalation ?? 0}</div>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Database size={14} /> Dokumen Gagal
          </div>
          <div className="text-4xl font-bold text-amber-600 mt-2">{stats?.failedDocs ?? 0}</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Volume bar chart */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold mb-4">Volume Chat 7 Hari Terakhir</h3>
          {volume.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-16">Belum ada data</p>
          ) : (
            <div className="h-48 flex items-end gap-2">
              {volume.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-gray-400">{v.count}</span>
                  <div
                    className="w-full bg-blue-500 rounded-t transition-all"
                    style={{ height: `${Math.max((v.count / maxVol) * 160, v.count > 0 ? 4 : 0)}px` }}
                  />
                  <span className="text-[9px] text-gray-400 truncate w-full text-center">{v.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top topics */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold mb-4">Top 5 Topik Pertanyaan</h3>
          {topics.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-16">Belum ada data</p>
          ) : (
            <div className="space-y-3">
              {topics.map((topic) => (
                <div key={topic.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{topic.label}</span>
                    <span className="font-medium">{topic.total}</span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${(topic.total / maxTopic) * 100}%` }}
                    />
      </div>

      {/* Action items */}
    </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action items */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
          <h3 className="font-semibold text-yellow-700">
            {stats?.pendingEscalation ?? 0} Tiket Eskalasi Pending
          </h3>
          <p className="text-sm text-yellow-600 mt-2">
            {stats?.pendingEscalation > 0 ? "Cek tab Eskalasi untuk detail." : "Tidak ada eskalasi pending."}
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <h3 className="font-semibold text-red-700">
            {stats?.failedDocs ?? 0} Dokumen Gagal Diindeks
          </h3>
          <p className="text-sm text-red-600 mt-2">
            {stats?.failedDocs > 0 ? "Perlu dilakukan re-indexing." : "Semua dokumen terindeks."}
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="font-semibold text-blue-700">
            {stats?.answerRate ?? 0}% Chat Terjawab
          </h3>
          <p className="text-sm text-blue-600 mt-2">
            {(stats?.answerRate ?? 0) >= 80 ? "Tingkat jawaban bagus!" : "Pertimbangkan tambah dokumen FAQ."}
          </p>
        </div>
      </div>
    </div>
  );
}

function EscalationTab() {
  const [tickets, setTickets]   = useState<any[]>([]);
  const [escStats, setEscStats] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch]     = useState("");
  const [loadingEsc, setLoadingEsc] = useState(true);
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [replyTicket, setReplyTicket] = useState<any>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [replySending, setReplySending] = useState(false);

  const reasonLabel: Record<string, { label: string; cls: string }> = {
    low_confidence: { label: "Confidence rendah", cls: "bg-red-100 text-red-700" },
    no_answer:      { label: "Tidak terjawab",    cls: "bg-amber-100 text-amber-700" },
    no_context:     { label: "Tidak ada konteks", cls: "bg-blue-100 text-blue-700" },
    manual:         { label: "Manual",             cls: "bg-gray-100 text-gray-700" },
  };

  const fetchEscalations = async () => {
    setLoadingEsc(true);
    try {
      const [t, s] = await Promise.all([
        getEscalations(statusFilter, search),
        getEscalationStats(),
      ]);
      setTickets(t.tickets ?? []);
      setEscStats(s);
    } catch {
      // silently ignore
    } finally {
      setLoadingEsc(false);
    }
  };

  useEffect(() => { fetchEscalations(); }, [statusFilter]);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") fetchEscalations();
  };

  const handleOpenReply = (ticket: any) => {
    setReplyTicket(ticket);
    setReplyMessage("");
    setReplyModalOpen(true);
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim() || !replyTicket) return;
    setReplySending(true);
    try {
      await replyEscalation(replyTicket.id, replyMessage.trim());
      setReplyModalOpen(false);
      setReplyTicket(null);
      setReplyMessage("");
      await fetchEscalations();
    } catch {
      // silently ignore
    } finally {
      setReplySending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-5">
          <p className="text-xs text-gray-500">Pending hari ini</p>
          <p className="text-4xl font-bold text-amber-500 mt-2">{escStats?.pendingToday ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-xs text-gray-500">Selesai minggu ini</p>
          <p className="text-4xl font-bold text-green-600 mt-2">{escStats?.resolvedWeek ?? 0}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <span className="font-semibold">Tiket Eskalasi</span>
            <span className="px-2 py-1 text-xs rounded-full bg-gray-100">{tickets.length} tiket</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {["pending", "resolved", "all"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs capitalize transition ${
                  statusFilter === s
                    ? "bg-[#0A2A8B] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s === "all" ? "Semua" : s === "pending" ? "Pending" : "Selesai"}
              </button>
            ))}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearch}
                placeholder="Cari user atau pertanyaan..."
                className="pl-8 h-9 w-52 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:ring-[#0A2A8B]"
              />
            </div>
            <button
              onClick={fetchEscalations}
              className="h-9 px-3 rounded-lg border flex items-center gap-2 text-sm hover:bg-gray-50"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {loadingEsc ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-[#0A2A8B]" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">Tidak ada tiket ditemukan.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Pertanyaan</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Waktu</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Alasan</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => {
                  const r = reasonLabel[ticket.reason] ?? { label: ticket.reason, cls: "bg-gray-100 text-gray-700" };
                  return (
                    <tr key={ticket.id} className="border-b hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-xs">{ticket.user}</p>
                        <p className="text-[11px] text-gray-400">{ticket.email}</p>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="truncate text-xs">{ticket.hasImage ? `[Gambar] ` : ""}{ticket.question}</p>
                        {ticket.confidence != null && ticket.confidence > 0 && (
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Confidence: {Number(ticket.confidence).toFixed(2)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {ticket.date}<br />{ticket.time}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${r.cls}`}>
                          {r.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          ticket.status === "pending"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-green-100 text-green-700"
                        }`}>
                          {ticket.status === "pending" ? "Pending" : "Selesai"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {ticket.status === "pending" && (
                          <button
                            onClick={() => handleOpenReply(ticket)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg hover:bg-[#0A2A8B] hover:text-white text-xs transition"
                          >
                            <Send size={12} />
                            Balas
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reply Modal */}
      {replyModalOpen && replyTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-800">Balas Tiket Eskalasi</h3>
                <button
                  onClick={() => { setReplyModalOpen(false); setReplyTicket(null); }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
                >
                  <XCircle size={18} />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Penerima</p>
                  <p className="text-sm font-medium">{replyTicket.user}</p>
                  <p className="text-xs text-gray-500">{replyTicket.email}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Pertanyaan</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{replyTicket.question}</p>
                </div>
                <div className="flex gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Alasan</p>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">
                      {replyTicket.reason === "low_confidence" ? "Confidence rendah" :
                       replyTicket.reason === "no_answer" ? "Tidak terjawab" :
                       replyTicket.reason === "no_context" ? "Tidak ada konteks" :
                       replyTicket.reason === "manual" ? "Manual" : replyTicket.reason}
                    </span>
                  </div>
                  {replyTicket.confidence != null && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Confidence</p>
                      <p className="text-sm">{Number(replyTicket.confidence).toFixed(2)}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Balasan Anda</label>
                <textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Tulis balasan untuk pengguna..."
                  rows={4}
                  className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2A8B] focus:border-transparent resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setReplyModalOpen(false); setReplyTicket(null); }}
                  className="px-4 py-2 rounded-lg border text-sm text-gray-600 hover:bg-gray-50 transition"
                >
                  Batal
                </button>
                <button
                  onClick={handleSendReply}
                  disabled={replySending || !replyMessage.trim()}
                  className="px-5 py-2 rounded-lg bg-[#0A2A8B] text-white text-sm font-medium hover:bg-[#081f66] transition disabled:opacity-50 flex items-center gap-2"
                >
                  {replySending ? (
                    <><Loader2 size={14} className="animate-spin" /> Mengirim...</>
                  ) : (
                    <><Send size={14} /> Kirim Balasan</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [docs, setDocs] = useState<Document[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [tab, setTab] = useState<"overview" | "documents" | "eskalasi" | "users" | "reports"> ("overview");
  const [searchDocs, setSearchDocs] = useState("");
  const [searchUsers, setSearchUsers] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchDocs = useCallback(async () => {
    try {
      const data = await getDocuments();
      setDocs(data.documents);
    } catch {
      // silently ignore polling errors
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data.users);
    } catch {
      // silently ignore
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) { router.push("/login"); return; }
      if (user.role !== "ADMIN") { router.push("/chatbot"); return; }
      fetchDocs();
      fetchUsers();
    }
  }, [authLoading, user, router, fetchDocs]);

  useEffect(() => {
    const hasProcessing = docs.some((d) => d.status === "processing");
    
    if (!hasProcessing) return;

    const interval = setInterval(async () => {
      await fetchDocs();
    }, 3000); 

    return () => clearInterval(interval);
  }, [docs, fetchDocs]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain", "text/markdown", "text/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (!allowed.includes(file.type)) {
      showToast("Format tidak didukung. Gunakan PDF, DOCX, TXT, MD, CSV, atau XLSX.", "error");
      return;
    }
    setUploading(true);
    try {
      await uploadDocument(file);
      showToast(`"${file.name}" berhasil diupload dan sedang diindeks.`);
      await fetchDocs();
    } catch (e: any) {
      showToast(e.message || "Gagal upload dokumen.", "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Hapus "${doc.originalName}"? Data vektor akan ikut dihapus dari Qdrant.`)) return;
    setDeletingId(doc.id);
    try {
      await deleteDocument(doc.id);
      showToast(`"${doc.originalName}" berhasil dihapus.`);
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (e: any) {
      showToast(e.message || "Gagal menghapus dokumen.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleRetry = async (doc: Document) => {
    setRetryingId(doc.id);
    try {
      await reindexDocument(doc.id);
      showToast(`Re-index "${doc.originalName}" dimulai.`);
      await fetchDocs();
    } catch (e: any) {
      showToast(e.message || "Gagal re-index dokumen.", "error");
    } finally {
      setRetryingId(null);
    }
  };

  const handleToggleUserStatus = async (u: User) => {
    try {
      await toggleUserStatus(u.id, !u.isActive);
      showToast(`User ${u.username} ${!u.isActive ? "diaktifkan" : "dinonaktifkan"}.`);
      await fetchUsers();
    } catch (e: any) {
      showToast(e.message || "Gagal update status user.", "error");
    }
  };

  const handleToggleUserRole = async (u: User) => {
    const newRole = u.role === "ADMIN" ? "USER" : "ADMIN";
    try {
      await updateUserRole(u.id, newRole);
      showToast(`Role ${u.username} diubah ke ${newRole}.`);
      await fetchUsers();
    } catch (e: any) {
      showToast(e.message || "Gagal update role user.", "error");
    }
  };

  const handleDeleteUser = async (u: User) => {
    if (!confirm(`Hapus user "${u.fullName}" (@${u.username})? Semua data chat, eskalasi, dan log aktivitas akan ikut terhapus.`)) return;
    try {
      await deleteUser(u.id);
      showToast(`User ${u.username} berhasil dihapus.`);
      await fetchUsers();
    } catch (e: any) {
      showToast(e.message || "Gagal menghapus user.", "error");
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#f6f6f7] flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#0A2A8B]" />
      </div>
    );
  }

  const indexed    = docs.filter((d) => d.status === "indexed").length;
  const processing = docs.filter((d) => d.status === "processing").length;
  const failed     = docs.filter((d) => d.status === "failed").length;

  const filteredDocs = searchDocs
    ? docs.filter(d =>
        d.originalName.toLowerCase().includes(searchDocs.toLowerCase()) ||
        d.uploadedBy?.username?.toLowerCase().includes(searchDocs.toLowerCase()) ||
        d.uploadedBy?.fullName?.toLowerCase().includes(searchDocs.toLowerCase())
      )
    : docs;

  const filteredUsers = searchUsers
    ? users.filter(u =>
        u.username.toLowerCase().includes(searchUsers.toLowerCase()) ||
        u.email.toLowerCase().includes(searchUsers.toLowerCase()) ||
        u.fullName.toLowerCase().includes(searchUsers.toLowerCase())
      )
    : users;

  return (
    <div className="min-h-screen bg-[#f6f6f7] text-gray-900 font-sans">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border transition-all
          ${toast.type === "success"
            ? "bg-white border-emerald-200 text-emerald-700"
            : "bg-white border-red-200 text-red-600"}`}>
          {toast.type === "success" ? <CheckCircle size={15} /> : <XCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-3 group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0A2A8B] text-white">
              <ShieldCheck size={15} />
            </div>
            {/* <span className="font-bold text-[#0A2A8B] text-base tracking-tight">Admin Panel</span> */}
            {/* <span className="text-gray-300">·</span>  */}

        <span className="font-bold text-[#0A2A8B] text-base tracking-tight group-hover:text-[#081f66] transition">
          Admin Panel
        </span>
      </Link>

      <span className="text-gray-300">·</span>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                  onClick={() => setTab("overview")}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                    tab === "overview"
                      ? "bg-white shadow text-[#0A2A8B]"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Home size={12} className="inline mr-1" />
                  Overview
                </button>
              <button
                onClick={() => setTab("documents")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition ${tab === "documents" ? "bg-white shadow text-[#0A2A8B]" : "text-gray-500 hover:text-gray-700"}`}
              >
                <Database size={12} className="inline mr-1" />Dokumen
              </button>
              <button
                onClick={() => setTab("eskalasi")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                  tab === "eskalasi"
                    ? "bg-white shadow text-[#0A2A8B]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <AlertTriangle size={12} className="inline mr-1" />
                Eskalasi
              </button>
              <button
                onClick={() => setTab("users")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition ${tab === "users" ? "bg-white shadow text-[#0A2A8B]" : "text-gray-500 hover:text-gray-700"}`}
              >
                <Users size={12} className="inline mr-1" />Users
              </button>
              <button
                onClick={() => setTab("reports")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition ${tab === "reports" ? "bg-white shadow text-[#0A2A8B]" : "text-gray-500 hover:text-gray-700"}`}
              >
                <BarChart2 size={12} className="inline mr-1" />Laporan
              </button>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#0A2A8B] transition"
          >
            <LogOut size={14} /> Keluar
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {tab === "overview" && <OverviewTab />}

        {tab === "eskalasi" && <EscalationTab />}

        {tab === "documents" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Terindeks",  value: indexed,    color: "text-emerald-600", bg: "bg-white border-gray-200", dot: "bg-emerald-500" },
                { label: "Memproses",  value: processing, color: "text-amber-600",   bg: "bg-white border-gray-200", dot: "bg-amber-400"   },
                { label: "Gagal",      value: failed,     color: "text-red-600",     bg: "bg-white border-gray-200", dot: "bg-red-500"     },
              ].map(({ label, value, color, bg, dot }) => (
                <div key={label} className={`rounded-xl border p-5 shadow-sm ${bg}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-2 h-2 rounded-full ${dot}`} />
                    <p className="text-xs text-gray-500 font-medium">{label}</p>
                  </div>
                  <p className={`text-3xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Upload area */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => { e.preventDefault(); setDragActive(false); handleUpload(e.dataTransfer.files); }}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer select-none bg-white
                ${dragActive ? "border-[#0A2A8B] bg-blue-50" : "border-gray-200 hover:border-[#0A2A8B] hover:bg-blue-50/30"}
                ${uploading ? "pointer-events-none opacity-60" : ""}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.xls"
                onChange={(e) => handleUpload(e.target.files)}
              />
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                {uploading ? (
                  <>
                    <Loader2 size={28} className="animate-spin text-[#0A2A8B]" />
                    <p className="text-sm text-gray-500">Mengupload dan mengindeks...</p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-[#0A2A8B] flex items-center justify-center">
                      <Upload size={20} className="text-white" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-700">Drag & drop atau klik untuk upload</p>
                      <p className="text-xs text-gray-400 mt-1">PDF, DOCX, TXT, MD, CSV, XLSX · Maks 50 MB</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Document list */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Database size={14} className="text-gray-400" />
                  <h2 className="text-sm font-semibold text-gray-700">Dokumen Knowledge Base</h2>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                    {filteredDocs.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-2 text-gray-400" />
                    <input
                      value={searchDocs}
                      onChange={(e) => setSearchDocs(e.target.value)}
                      placeholder="Cari dokumen..."
                      className="pl-7 h-8 w-44 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-[#0A2A8B]"
                    />
                  </div>
                  <button onClick={fetchDocs} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#0A2A8B] transition">
                    <RefreshCw size={11} /> Refresh
                  </button>
                </div>
              </div>

              {docs.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm">
                  <p className="text-sm text-gray-400">Belum ada dokumen. Upload dokumen pertama kamu.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden divide-y divide-gray-100">
                  {filteredDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                        <FileIcon mimeType={doc.mimeType} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{doc.originalName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatBytes(doc.sizeBytes)} · {doc.uploadedBy.username} ·{" "}
                          {new Date(doc.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                        {doc.status === "failed" && doc.errorMessage && (
                          <p className="text-xs text-red-500 mt-1 truncate">{doc.errorMessage}</p>
                        )}
                      </div>
                      <StatusBadge status={doc.status} />
                      {doc.status === "failed" && (
                        <button
                          onClick={() => handleRetry(doc)}
                          disabled={retryingId === doc.id}
                          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-amber-500 hover:bg-amber-50 transition disabled:opacity-40"
                          title="Coba lagi"
                        >
                          {retryingId === doc.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(doc)}
                        disabled={deletingId === doc.id}
                        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-40"
                      >
                        {deletingId === doc.id ? <Loader2 size={14} className="animate-spin text-gray-400" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {tab === "users" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-700">Manajemen User</h2>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                  {filteredUsers.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-2 text-gray-400" />
                  <input
                    value={searchUsers}
                    onChange={(e) => setSearchUsers(e.target.value)}
                    placeholder="Cari user..."
                    className="pl-7 h-8 w-44 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-[#0A2A8B]"
                  />
                </div>
                <button onClick={fetchUsers} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#0A2A8B] transition">
                  <RefreshCw size={11} /> Refresh
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">User</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Email</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Role</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Bergabung</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[#0A2A8B]/10 flex items-center justify-center">
                            <UserCheck size={12} className="text-[#0A2A8B]" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-xs">{u.fullName}</p>
                            <p className="text-[11px] text-gray-400">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-600">{u.email}</td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => handleToggleUserRole(u)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition ${
                            u.role === "ADMIN"
                              ? "bg-[#0A2A8B]/10 text-[#0A2A8B] border-[#0A2A8B]/20 hover:bg-[#0A2A8B]/20"
                              : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200"
                          }`}
                        >
                          {u.role}
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => handleToggleUserStatus(u)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition ${
                            u.isActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                          }`}
                        >
                          {u.isActive ? "Aktif" : "Nonaktif"}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500">
                        {new Date(u.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleToggleUserStatus(u)}
                          className="text-[11px] text-gray-400 hover:text-[#0A2A8B] transition font-medium"
                        >
                          {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="text-[11px] text-gray-400 hover:text-red-500 transition font-medium ml-3"
                        >
                          <Trash2 size={12} className="inline mr-0.5" /> Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <div className="py-16 text-center">
                  <p className="text-sm text-gray-400">Belum ada user terdaftar.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "reports" && <ReportTab />}

      </main>
    </div>
  );
}
