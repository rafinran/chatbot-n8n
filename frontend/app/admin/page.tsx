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
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getDocuments, uploadDocument, deleteDocument } from "@/lib/api";

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv"))
    return <FileSpreadsheet size={15} className="text-[#0A2A8B]" />;
  if (mimeType.includes("pdf"))
    return <FileText size={15} className="text-[#0A2A8B]" />;
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

export default function AdminPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
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

  useEffect(() => {
    if (!authLoading) {
      if (!user) { router.push("/login"); return; }
      if (user.role !== "ADMIN") { router.push("/chatbot"); return; }
      fetchDocs();
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

      {/* Navbar — sama persis dengan chatbot */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0A2A8B] text-white">
              <ShieldCheck size={15} />
            </div>
            <span className="font-bold text-[#0A2A8B] text-base tracking-tight">Admin Panel</span>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-500">Knowledge Base Manager</span>
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

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Terindeks",  value: indexed,    color: "text-emerald-600", bg: "bg-white border-gray-200",  dot: "bg-emerald-500" },
            { label: "Memproses",  value: processing, color: "text-amber-600",   bg: "bg-white border-gray-200",  dot: "bg-amber-400"   },
            { label: "Gagal",      value: failed,     color: "text-red-600",     bg: "bg-white border-gray-200",  dot: "bg-red-500"     },
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
            ${dragActive
              ? "border-[#0A2A8B] bg-blue-50"
              : "border-gray-200 hover:border-[#0A2A8B] hover:bg-blue-50/30"}
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
                {docs.length}
              </span>
            </div>
            <button
              onClick={fetchDocs}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#0A2A8B] transition"
            >
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
                <div
                  key={doc.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition"
                >
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
                  <button
                    onClick={() => handleDelete(doc)}
                    disabled={deletingId === doc.id}
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-40"
                  >
                    {deletingId === doc.id
                      ? <Loader2 size={14} className="animate-spin text-gray-400" />
                      : <Trash2 size={14} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
