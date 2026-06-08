"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
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
      const res = await fetch(`/api/reports/send?type=${type}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim laporan.");
      showToast(data.message, "success");
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
            {["Total & % chat terjawab minggu ini", "Clustering topik via AI (Gemini)", "Analisis gap FAQ dengan AI", "5 user paling aktif minggu ini"].map((item) => (
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
  const stats = {
    totalChat: 47,
    answered: 78,
    responseTime: 3.2,
    pendingEscalation: 5,
  };

  const topTopics = [
    { label: "Kualitas cetak", total: 110 },
    { label: "Masalah tinta", total: 88 },
    { label: "Koneksi WiFi", total: 62 },
    { label: "Update firmware", total: 47 },
    { label: "Install driver", total: 33 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            Overview
          </h2>
          <p className="text-sm text-gray-400">
            Terakhir diperbarui: {new Date().toLocaleString("id-ID")}
          </p>
        </div>

        <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50">
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* KPI */}

      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <MessageCircle size={14} />
            Total Chat Hari Ini
          </div>

          <div className="text-4xl font-bold text-blue-600 mt-2">
            {stats.totalChat}
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <CheckCircle size={14} />
            Chat Terjawab
          </div>

          <div className="text-4xl font-bold text-green-600 mt-2">
            {stats.answered}%
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Clock3 size={14} />
            Avg Response
          </div>

          <div className="text-4xl font-bold text-amber-600 mt-2">
            {stats.responseTime}s
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <AlertTriangle size={14} />
            Eskalasi Pending
          </div>

          <div className="text-4xl font-bold text-red-500 mt-2">
            {stats.pendingEscalation}
          </div>
        </div>
      </div>

      {/* Chart Dummy */}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold mb-4">
            Volume Chat 7 Hari Terakhir
          </h3>

          <div className="h-64 flex items-end gap-3">
            {[28, 34, 18, 41, 33, 44, 47].map((v, i) => (
              <div
                key={i}
                className="flex-1 bg-blue-500 rounded-t"
                style={{ height: `${v * 4}px` }}
              />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold mb-4">
            Top 5 Topik Pertanyaan
          </h3>

          <div className="space-y-4">
            {topTopics.map((topic) => (
              <div key={topic.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{topic.label}</span>
                  <span>{topic.total}</span>
                </div>

                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500"
                    style={{
                      width: `${topic.total / 1.1}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action Items */}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
          <h3 className="font-semibold text-yellow-700">
            5 Tiket Eskalasi Pending
          </h3>

          <p className="text-sm text-yellow-600 mt-2">
            Belum ada agen yang menangani tiket hari ini.
          </p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <h3 className="font-semibold text-red-700">
            3 Dokumen Gagal Diindeks
          </h3>

          <p className="text-sm text-red-600 mt-2">
            Perlu dilakukan re-indexing.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="font-semibold text-blue-700">
            8 FAQ Gap Baru
          </h3>

          <p className="text-sm text-blue-600 mt-2">
            Belum ada jawaban di knowledge base.
          </p>
        </div>
      </div>
    </div>
  );
}

function EscalationTab() {
  const tickets = [
    {
      id: 1,
      user: "Aku Testing",
      username: "@gemini",
      question:
        "[Gambar] Kira kira kalau ada warna begitu kenapa ya?",
      confidence: 0.21,
      reason: "Confidence rendah",
      status: "Pending",
      date: "08 Jun",
      time: "14:32",
      badge: "danger",
    },
    {
      id: 2,
      user: "RafIndran",
      username: "@ranz",
      question: "halo",
      confidence: 0,
      reason: "Tidak ada konteks pertanyaan",
      status: "Pending",
      date: "08 Jun",
      time: "13:15",
      badge: "manual",
    },
    {
      id: 3,
      user: "Epson",
      username: "@admin",
      question: "Cara reset Ink pad L3150 sudah penuh?",
      confidence: 0.38,
      reason: "Tidak relevan",
      status: "Selesai",
      date: "07 Jun",
      time: "09:44",
      badge: "done",
    },
  ];

  return (
    <div className="space-y-6">

      {/* KPI */}
      <div className="grid md:grid-cols-3 gap-4">

        <div className="bg-white rounded-xl border p-5">
          <p className="text-xs text-gray-500">
            Pending hari ini
          </p>
          <p className="text-4xl font-bold text-amber-500 mt-2">
            5
          </p>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <p className="text-xs text-gray-500">
            Selesai minggu ini
          </p>
          <p className="text-4xl font-bold text-green-600 mt-2">
            23
          </p>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <p className="text-xs text-gray-500">
            Avg waktu tangani
          </p>
          <p className="text-4xl font-bold text-blue-600 mt-2">
            2.4
          </p>
          <p className="text-xs text-gray-400">
            jam
          </p>
        </div>

      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">

        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b">

          <div className="flex items-center gap-2">
            <AlertTriangle
              size={16}
              className="text-amber-500"
            />
            <span className="font-semibold">
              Tiket Eskalasi
            </span>

            <span className="px-2 py-1 text-xs rounded-full bg-gray-100">
              28 total
            </span>
          </div>

          <div className="flex items-center gap-2">

            <button className="px-3 py-1.5 rounded-lg text-xs bg-amber-100 text-amber-700">
              Pending
            </button>

            <button className="px-3 py-1.5 rounded-lg text-xs bg-gray-100 text-gray-600">
              7 hari
            </button>

            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-2.5 text-gray-400"
              />

              <input
                placeholder="Cari user atau pertanyaan..."
                className="pl-8 h-9 w-64 rounded-lg border text-sm"
              />
            </div>

            <button className="h-9 px-3 rounded-lg border flex items-center gap-2 text-sm">
              <RefreshCw size={14} />
              Refresh
            </button>

          </div>
        </div>

        <table className="w-full text-sm">

          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3">User</th>
              <th className="text-left px-4 py-3">Pertanyaan</th>
              <th className="text-left px-4 py-3">Waktu</th>
              <th className="text-left px-4 py-3">Alasan Eskalasi</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Aksi</th>
            </tr>
          </thead>

          <tbody>

            {tickets.map((ticket) => (
              <tr
                key={ticket.id}
                className="border-b hover:bg-gray-50"
              >
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium">
                      {ticket.user}
                    </p>
                    <p className="text-xs text-gray-400">
                      {ticket.username}
                    </p>
                  </div>
                </td>

                <td className="px-4 py-3">
                  <p>{ticket.question}</p>

                  {ticket.confidence > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      Confidence RAG:
                      {" "}
                      {ticket.confidence}
                    </p>
                  )}
                </td>

                <td className="px-4 py-3 text-sm">
                  {ticket.date}
                  <br />
                  {ticket.time}
                </td>

                <td className="px-4 py-3">

                  {ticket.badge === "manual" && (
                    <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                      Manual
                    </span>
                  )}

                  {ticket.badge === "danger" && (
                    <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">
                      Confidence rendah
                    </span>
                  )}

                  {ticket.badge === "done" && (
                    <span className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700">
                      Tidak relevan
                    </span>
                  )}

                </td>

                <td className="px-4 py-3">

                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      ticket.status === "Pending"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {ticket.status}
                  </span>

                </td>

                <td className="px-4 py-3 text-right">

                  <button className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-lg hover:bg-gray-50">
                    <Eye size={14} />
                    Detail
                  </button>

                </td>
              </tr>
            ))}

          </tbody>
        </table>
      </div>
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
    if (hasProcessing) {
      pollRef.current = setTimeout(fetchDocs, 4000);
    }
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0A2A8B] text-white">
              <ShieldCheck size={15} />
            </div>
            <span className="font-bold text-[#0A2A8B] text-base tracking-tight">Admin Panel</span>
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
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">{docs.length}</span>
                </div>
                <button onClick={fetchDocs} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#0A2A8B] transition">
                  <RefreshCw size={11} /> Refresh
                </button>
              </div>

              {docs.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm">
                  <p className="text-sm text-gray-400">Belum ada dokumen. Upload dokumen pertama kamu.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden divide-y divide-gray-100">
                  {docs.map((doc) => (
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
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">{users.length}</span>
              </div>
              <button onClick={fetchUsers} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#0A2A8B] transition">
                <RefreshCw size={11} /> Refresh
              </button>
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
                  {users.map((u) => (
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
