"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search,
  MessageSquare,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  Plus,
  X,
} from "lucide-react";
import {
  listConversations,
  createConversation,
  deleteConversation,
} from "@/lib/api";

interface Conversation {
  id: number;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ConversationSidebarProps {
  activeConversationId: number | null;
  onSelectConversation: (id: number) => void;
  onNewConversation: () => void;
}

function groupByDate(conversations: Conversation[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const last7 = new Date(today.getTime() - 7 * 86400000);
  const last30 = new Date(today.getTime() - 30 * 86400000);

  const groups: { label: string; items: Conversation[] }[] = [
    { label: "Hari ini", items: [] },
    { label: "Kemarin", items: [] },
    { label: "7 hari lalu", items: [] },
    { label: "30 hari lalu", items: [] },
    { label: "Lebih lama", items: [] },
  ];

  for (const c of conversations) {
    const d = new Date(c.updatedAt);
    if (d >= today) groups[0].items.push(c);
    else if (d >= yesterday) groups[1].items.push(c);
    else if (d >= last7) groups[2].items.push(c);
    else if (d >= last30) groups[3].items.push(c);
    else groups[4].items.push(c);
  }

  return groups.filter((g) => g.items.length > 0);
}

export function ConversationSidebar({
  activeConversationId,
  onSelectConversation,
  onNewConversation,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const confirmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
  }, [activeConversationId]);

  // Tutup confirm popover kalau klik di luar
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (confirmRef.current && !confirmRef.current.contains(e.target as Node)) {
        setConfirmDeleteId(null);
      }
    }
    if (confirmDeleteId !== null) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [confirmDeleteId]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const res = await listConversations();
      setConversations(res.conversations ?? []);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = async () => {
    try {
      const res = await createConversation();
      if (res?.conversation) {
        setConversations((prev) => [res.conversation, ...prev]);
        onSelectConversation(res.conversation.id);
      } else {
        onNewConversation();
      }
    } catch {
      onNewConversation();
    }
    setSearchQuery("");
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) onNewConversation();
    } catch {
      // silent — bisa tambah toast kalau mau
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const filtered = conversations.filter((c) =>
    (c.title ?? "New conversation")
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const groups = groupByDate(filtered);

  // ── Collapsed ────────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div className="flex h-full w-14 flex-shrink-0 flex-col items-center border-r bg-white py-3 gap-3">
        <button
          onClick={() => setCollapsed(false)}
          title="Buka sidebar"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-[#0A2A8B] transition"
        >
          <PanelLeft size={18} />
        </button>
        <button
          onClick={handleNewChat}
          title="Chat baru"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0A2A8B] text-white hover:bg-[#081f63] transition"
        >
          <Plus size={16} />
        </button>
      </div>
    );
  }

  // ── Expanded ─────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-64 flex-shrink-0 flex-col border-r bg-white">

      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b flex-shrink-0">
        <button
          onClick={handleNewChat}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0A2A8B] px-4 py-2 text-sm font-medium text-white hover:bg-[#081f63] transition"
        >
          <Plus size={15} />
          Chat Baru
        </button>
        <button
          onClick={() => setCollapsed(true)}
          title="Tutup sidebar"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-[#0A2A8B] transition"
        >
          <PanelLeftClose size={17} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-[#f6f6f7] px-3 py-1.5">
          <Search size={13} className="flex-shrink-0 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari percakapan..."
            className="w-full bg-transparent text-xs text-gray-700 placeholder:text-gray-400 outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {loading ? (
          <div className="flex flex-col gap-1.5 px-2 pt-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-gray-400">
            {searchQuery ? "Tidak ada hasil" : "Belum ada percakapan"}
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((conv) => {
                  const isActive = activeConversationId === conv.id;
                  const title = conv.title || "New conversation";
                  return (
                    <div key={conv.id} className="relative group/item">
                      <button
                        onClick={() => onSelectConversation(conv.id)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 pr-8 text-left text-sm transition ${
                          isActive
                            ? "bg-[#0A2A8B] text-white"
                            : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        <MessageSquare
                          size={14}
                          className={`mt-0.5 flex-shrink-0 ${
                            isActive ? "text-white/80" : "text-gray-400"
                          }`}
                        />
                        <span className="truncate text-xs leading-snug">{title}</span>
                      </button>

                      {/* Delete — muncul saat hover */}
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 transition">
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(conv.id);
                            }}
                            className={`flex h-6 w-6 items-center justify-center rounded-md transition ${
                              isActive
                                ? "text-white/60 hover:text-white hover:bg-white/20"
                                : "text-gray-400 hover:text-red-500 hover:bg-red-50"
                            }`}
                            title="Hapus"
                          >
                            <Trash2 size={12} />
                          </button>

                          {/* Confirm popover */}
                          {confirmDeleteId === conv.id && (
                            <div
                              ref={confirmRef}
                              className="absolute right-0 bottom-8 z-30 w-44 rounded-xl border bg-white shadow-lg p-3"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <p className="mb-2 text-xs font-medium text-gray-700">
                                Hapus percakapan ini?
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleDelete(conv.id)}
                                  disabled={deletingId === conv.id}
                                  className="flex-1 rounded-lg bg-red-500 py-1 text-xs text-white hover:bg-red-600 transition disabled:opacity-50"
                                >
                                  {deletingId === conv.id ? "..." : "Hapus"}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="flex-1 rounded-lg border py-1 text-xs hover:bg-gray-50 transition"
                                >
                                  Batal
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
