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
    return <FileSpreadsheet size={16} className="text-emerald-400" />;
  if (mimeType.includes("pdf"))
    return <FileText size={16} className="text-red-400" />;
  return <File size={16} className="text-blue-400" />;
}

function StatusBadge({ status }: { status: Document["status"] }) {
  const map = {
    processing: { icon: <Loader2 size={12} className="animate-spin" />, label: "Memproses", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    indexed:    { icon: <CheckCircle size={12} />,                        label: "Terindeks",  cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    failed:     { icon: <XCircle size={12} />,                            label: "Gagal",      cls: "bg-red-500/10 text-red-400 border-red-500/20" },
  };
  const { icon, label, cls } = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border font-medium ${cls}`}>
      {icon} {label}
    </span>
  );
}

// test
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

  // Redirect kalau bukan admin
  useEffect(() => {
    if (!authLoading) {
      if (!user) { router.push("/login"); return; }
      if (user.role !== "ADMIN") { router.push("/chatbot"); return; }
      fetchDocs();
    }
  }, [authLoading, user, router, fetchDocs]);

  // Poll setiap 4 detik kalau ada dokumen yang masih processing
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
      <div className="min-h-screen bg-[#0c0f1a] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  const indexed = docs.filter((d) => d.status === "indexed").length;
  const processing = docs.filter((d) => d.status === "processing").length;
  const failed = docs.filter((d) => d.status === "failed").length;

  return (
    <div className="min-h-screen bg-[#0c0f1a] text-gray-100 font-sans">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium transition-all
          ${toast.type === "success" ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300" : "bg-red-500/10 border border-red-500/30 text-red-300"}`}>
          {toast.type === "success" ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Navbar */}
      <nav className="border-b border-white/5 bg-[#0e1221]/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <ShieldCheck size={14} className="text-indigo-400" />
            </div>
            <span className="font-semibold text-sm tracking-wide text-white">Admin Panel</span>
            <span className="text-white/20">·</span>
            <span className="text-xs text-gray-500">Knowledge Base Manager</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition"
          >
            <LogOut size={14} /> Keluar
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Terindeks", value: indexed, color: "text-emerald-400", bg: "bg-emerald-500/5 border-emerald-500/10" },
            { label: "Memproses", value: processing, color: "text-amber-400", bg: "bg-amber-500/5 border-amber-500/10" },
            { label: "Gagal", value: failed, color: "text-red-400", bg: "bg-red-500/5 border-red-500/10" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-xl border p-4 ${bg}`}>
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Upload area */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => { e.preventDefault(); setDragActive(false); handleUpload(e.dataTransfer.files); }}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer select-none
            ${dragActive ? "border-indigo-400 bg-indigo-500/10" : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"}
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
                <Loader2 size={28} className="animate-spin text-indigo-400" />
                <p className="text-sm text-gray-400">Mengupload dan mengindeks...</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <Upload size={20} className="text-indigo-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-300">Drag & drop atau klik untuk upload</p>
                  <p className="text-xs text-gray-600 mt-1">PDF, DOCX, TXT, MD, CSV, XLSX · Maks 50 MB</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Document list */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Database size={15} className="text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-300">Dokumen Knowledge Base</h2>
              <span className="text-xs text-gray-600 bg-white/5 px-2 py-0.5 rounded-full">{docs.length}</span>
            </div>
            <button
              onClick={fetchDocs}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          {docs.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] py-16 text-center">
              <p className="text-sm text-gray-600">Belum ada dokumen. Upload dokumen pertama kamu.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/5 overflow-hidden divide-y divide-white/5">
              {docs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-4 px-5 py-3.5 bg-white/[0.01] hover:bg-white/[0.03] transition">
                  <div className="flex-shrink-0">
                    <FileIcon mimeType={doc.mimeType} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">{doc.originalName}</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {formatBytes(doc.sizeBytes)} · {doc.uploadedBy.username} ·{" "}
                      {new Date(doc.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    {doc.status === "failed" && doc.errorMessage && (
                      <p className="text-xs text-red-400/80 mt-1 truncate">{doc.errorMessage}</p>
                    )}
                  </div>
                  <StatusBadge status={doc.status} />
                  <button
                    onClick={() => handleDelete(doc)}
                    disabled={deletingId === doc.id}
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-40"
                  >
                    {deletingId === doc.id
                      ? <Loader2 size={14} className="animate-spin" />
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
