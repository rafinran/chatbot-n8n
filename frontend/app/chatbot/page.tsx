"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Components } from "react-markdown";

import {
  Bot,
  SendHorizonal,
  Plus,
  X,
  ImageUp,
  LogOut,
  Menu,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  PanelLeftOpen,
}
  from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  sendMessageStream,
  getChatHistory,
  getChatHistoryByConversation,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ConversationSidebar } from "@/components/ConversationSidebar";

// ── Types ──────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
}

type FeedbackState = "idle" | "satisfied" | "escalated";

interface LinkMeta {
  title?: string;
  image?: string;
  siteName?: string;
  domain: string;
}

const suggestions = [
  "How do I refill the ink tanks?",
  "Why are my print results blurry?",
  "Help me connect my printer to Wi-Fi",
  "How do I fix a paper jam issue?",
];

// ── Feedback Buttons ───────────────────────────────────────────────────────

function FeedbackButtons({ messageId }: { messageId: string }) {
  const storageKey = `feedback_${messageId}`;
  const [state, setState] = useState<FeedbackState>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem(storageKey) as FeedbackState) || "idle";
    }
    return "idle";
  });

  const updateState = (newState: FeedbackState) => {
    setState(newState);
    localStorage.setItem(storageKey, newState);
  };

  if (state === "satisfied") {
    return (
      <p className="mt-2.5 flex items-center gap-1.5 text-xs text-gray-400">
        <ThumbsUp size={12} className="text-emerald-500" />
        Terima kasih atas feedback kamu!
      </p>
    );
  }

  if (state === "escalated") {
    return (
      <p className="mt-2.5 flex items-center gap-1.5 text-xs text-gray-400">
        <ThumbsDown size={12} className="text-red-400" />
        Mohon maaf, jawaban ini belum membantu. Silakan coba pertanyaan lain.
      </p>
    );
  }

  return (
    <div className="mt-2.5 flex items-center gap-3">
      <p className="text-xs text-gray-400">Apakah jawaban ini membantu?</p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => updateState("satisfied")}
          className="flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-600"
        >
          <ThumbsUp size={11} /> Ya
        </button>
        <button
          onClick={() => updateState("escalated")}
          className="flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-500"
        >
          <ThumbsDown size={11} /> Tidak
        </button>
      </div>
    </div>
  );
}

// ── useLinkPreview ─────────────────────────────────────────────────────────

function useLinkPreview(url: string) {
  const [meta, setMeta] = useState<LinkMeta | null>(null);

  useEffect(() => {
    let cancelled = false;
    const domain = (() => {
      try {
        return new URL(url).hostname.replace("www.", "");
      } catch {
        return url;
      }
    })();

    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setMeta({ ...data, domain });
      })
      .catch(() => {
        if (!cancelled) setMeta({ domain });
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return meta;
}

// ── LinkPreviewCard ────────────────────────────────────────────────────────

function LinkPreviewCard({ url }: { url: string }) {
  const meta = useLinkPreview(url);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex items-stretch overflow-hidden rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors no-underline max-w-sm"
    >
      <div className="flex w-16 flex-shrink-0 items-center justify-center bg-gray-100 sm:w-20">
        {meta?.image ? (
          <img
            src={meta.image}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <ExternalLink size={20} className="text-gray-400" />
        )}
      </div>
      <div className="flex min-w-0 flex-col justify-center px-3 py-2">
        {meta?.title ? (
          <p className="truncate text-xs font-medium text-gray-800 sm:text-sm">
            {meta.title}
          </p>
        ) : (
          <p className="truncate text-xs text-gray-500">{url}</p>
        )}
        <p className="mt-0.5 truncate text-[11px] text-gray-400">
          {meta?.domain ?? ""}
        </p>
      </div>
    </a>
  );
}

// ── Markdown link renderer ─────────────────────────────────────────────────

const markdownComponents: Components = {
  a: ({ href, children }) => {
    if (!href) return <span>{children}</span>;
    return (
      <span className="inline-block w-full">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline hover:text-blue-800 break-all"
        >
          {children}
        </a>
        <LinkPreviewCard url={href} />
      </span>
    );
  },
};

// ── Page ───────────────────────────────────────────────────────────────────

export default function ChatbotPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout: contextLogout } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [popupOpen, setPopupOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Mobile sidebar drawer
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    loadHistory();
  }, [authLoading, user, router, conversationId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      let response;
      if (conversationId) {
        response = await getChatHistoryByConversation(conversationId);
      } else {
        response = await getChatHistory();
      }
      if (response?.history && Array.isArray(response.history)) {
        setMessages(
          response.history.map((m: Omit<Message, "id">) => ({
            ...m,
            id: crypto.randomUUID(),
          }))
        );
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!message.trim() || sending) return;

    const userMessage = message;
    const imageFile = attachedFiles[0] ?? null;
    const imagePreviewUrl = imageFile ? URL.createObjectURL(imageFile) : undefined;
    const assistantId = crypto.randomUUID();

    setMessage("");
    setPopupOpen(false);

    const newMessages: Message[] = [
      ...messages,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: userMessage,
        imageUrl: imagePreviewUrl,
      },
      {
        id: assistantId,
        role: "assistant",
        content: "",
      },
    ];
    setMessages(newMessages);
    setSending(true);

    try {
      let payload;
      if (imageFile) {
        const formData = new FormData();
        formData.append("message", userMessage);
        formData.append("image", imageFile);
        if (conversationId) formData.append("conversationId", conversationId.toString());
        payload = formData;
      } else {
        const msgPayload: { message: string; conversationId?: number } = {
          message: userMessage,
        };
        if (conversationId) msgPayload.conversationId = conversationId;
        payload = msgPayload;
      }

      let fullContent = "";
      const result = await sendMessageStream(
        payload,
        (token) => {
          fullContent += token;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: fullContent } : m
            )
          );
        },
        (url) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.role === "user" && m.imageUrl ? { ...m, imageUrl: url } : m
            )
          );
        },
      );

      if (result.conversationId && !conversationId) {
        setConversationId(result.conversationId);
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `Error: ${err.message || "Failed to send message"}` }
            : m
        )
      );
    } finally {
      setSending(false);
      setAttachedFiles([]);
      setPendingFiles([]);
    }
  };

  const handleLogout = async () => {
    try {
      await contextLogout();
      router.push("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).filter(
      (f) => !pendingFiles.find((p) => p.name === f.name)
    );
    setPendingFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) =>
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));

  const attachImages = () => {
    setAttachedFiles([...pendingFiles]);
    setPopupOpen(false);
  };

  const handleSelectConversation = (id: number) => {
    setConversationId(id);
    setMobileSidebarOpen(false);
  };

  const handleNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    setMobileSidebarOpen(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f6f7]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0A2A8B] border-t-transparent" />
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-[#f6f6f7] text-black overflow-hidden">

      {/* ── NAVBAR ── */}
      <header className="border-b bg-white z-10 flex-shrink-0">
        <div className="mx-auto flex h-14 sm:h-16 max-w-full items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3 sm:gap-6 lg:gap-14">
            {/* Mobile: tombol buka sidebar */}
            <button
              onClick={() => setMobileSidebarOpen((o) => !o)}
              className="md:hidden flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100 transition text-gray-500"
              title="Riwayat chat"
            >
              <PanelLeftOpen size={19} />
            </button>

            <a href="/">
              <h1 className="text-base sm:text-xl font-bold text-[#0A2A8B] cursor-pointer whitespace-nowrap">
                WEBSON & CHATSON
              </h1>
            </a>
            <nav className="hidden md:flex items-center gap-8 lg:gap-10 text-sm text-gray-600">
              <a href="#" className="hover:text-[#0A2A8B] transition">Solutions</a>
              <a href="#" className="hover:text-[#0A2A8B] transition">Platform</a>
              <a href="#" className="hover:text-[#0A2A8B] transition">Enterprise</a>
              <a href="#" className="hover:text-[#0A2A8B] transition">Pricing</a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-gray-600 truncate max-w-[120px]">
              {user?.fullName || user?.username}
            </span>
            <button
              onClick={handleLogout}
              className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-[#0A2A8B] transition"
            >
              <LogOut size={16} /> Logout
            </button>
            {/* Mobile: hamburger untuk nav links */}
            <button
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="md:hidden flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100 transition"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-white px-4 py-3 flex flex-col gap-3 text-sm">
            <div className="text-gray-500 font-medium">{user?.fullName || user?.username}</div>
            <a href="#" className="text-gray-700 hover:text-[#0A2A8B]">Solutions</a>
            <a href="#" className="text-gray-700 hover:text-[#0A2A8B]">Platform</a>
            <a href="#" className="text-gray-700 hover:text-[#0A2A8B]">Enterprise</a>
            <a href="#" className="text-gray-700 hover:text-[#0A2A8B]">Pricing</a>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-red-500 hover:text-red-700 transition font-medium"
            >
              <LogOut size={15} /> Logout
            </button>
          </div>
        )}
      </header>

      {/* ── SIDEBAR + MAIN ── */}
      <div className="flex-1 flex flex-row overflow-hidden relative">

        {/* Mobile sidebar overlay */}
        {mobileSidebarOpen && (
          <>
            {/* Backdrop */}
            <div
              className="md:hidden fixed inset-0 z-20 bg-black/30"
              onClick={() => setMobileSidebarOpen(false)}
            />
            {/* Drawer */}
            <div className="md:hidden fixed left-0 top-0 bottom-0 z-30 pt-14">
              <ConversationSidebar
                activeConversationId={conversationId}
                onSelectConversation={handleSelectConversation}
                onNewConversation={handleNewConversation}
              />
            </div>
          </>
        )}

        {/* Desktop sidebar — collapsible handled internally */}
        <div className="hidden md:flex h-full">
          <ConversationSidebar
            activeConversationId={conversationId}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
          />
        </div>

        {/* ── MAIN CHAT ── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (

              /* Empty state */
              <section className="flex min-h-full flex-col items-center justify-center px-4 sm:px-6 py-10">
                <div className="mb-6 sm:mb-8 flex h-20 w-20 sm:h-28 sm:w-28 items-center justify-center rounded-full border bg-white shadow-sm">
                  <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-[#0A2A8B] text-white">
                    <Bot size={26} className="sm:hidden" />
                    <Bot size={34} className="hidden sm:block" />
                  </div>
                </div>
                <h1 className="text-center text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0A2A8B]">
                  Hi, I'm Chatson
                </h1>
                <p className="mt-3 text-center text-base sm:text-lg text-muted-foreground">
                  Anything I can help with today?
                </p>
                <div className="mt-8 sm:mt-12 grid w-full max-w-xs sm:max-w-xl lg:max-w-3xl grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {suggestions.map((item) => (
                    <button
                      key={item}
                      onClick={() => setMessage(item)}
                      className="rounded-full border bg-white px-4 sm:px-6 py-3 sm:py-4 text-sm shadow-sm transition hover:border-[#0A2A8B] hover:shadow-md text-left sm:text-center"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </section>

            ) : (

              /* Chat messages */
              <section className="px-3 sm:px-6 py-6 sm:py-8">
                <div className="max-w-3xl mx-auto space-y-5 sm:space-y-6">
                  {messages.map((msg) => (
                    <div key={msg.id}>
                      {msg.role === "user" ? (

                        /* User bubble */
                        <div className="flex justify-end">
                          <div className="max-w-[85%] sm:max-w-[75%] flex flex-col items-end gap-2">
                            {msg.imageUrl && (
                              <img
                                src={msg.imageUrl}
                                alt="uploaded"
                                className="max-h-48 sm:max-h-60 rounded-2xl object-cover border border-white/20 shadow"
                              />
                            )}
                            <div className="rounded-2xl bg-[#0A2A8B] px-4 sm:px-5 py-3 text-white">
                              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                {msg.content}
                              </p>
                            </div>
                          </div>
                        </div>

                      ) : (

                        /* Assistant bubble */
                        <div className="flex items-start gap-2 sm:gap-3">
                          <div className="flex-shrink-0 mt-0.5 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-[#0A2A8B] text-white">
                            <Bot size={13} className="sm:hidden" />
                            <Bot size={14} className="hidden sm:block" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm leading-relaxed text-gray-800 prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ul:pl-5 prose-ul:list-disc prose-ol:my-1 prose-ol:pl-5 prose-ol:list-decimal prose-li:my-0.5 prose-strong:font-semibold prose-strong:text-gray-900 overflow-hidden">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={markdownComponents}
                              >
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                            <FeedbackButtons messageId={msg.id} />
                          </div>
                        </div>

                      )}
                    </div>
                  ))}

                  {/* Skeleton loading bubble */}
                  {sending && (
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="flex-shrink-0 mt-1 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-[#0A2A8B] text-white">
                        <Bot size={14} />
                      </div>
                      <div className="flex flex-col gap-2 px-4 py-3 bg-gray-100 rounded-2xl rounded-tl-sm max-w-[85%] sm:max-w-[75%] min-w-[200px]">
                        <div className="h-3 bg-gray-300 rounded-full animate-pulse w-[85%]" />
                        <div className="h-3 bg-gray-300 rounded-full animate-pulse w-[60%]" style={{ animationDelay: "200ms" }} />
                        <div className="h-3 bg-gray-300 rounded-full animate-pulse w-[72%]" style={{ animationDelay: "400ms" }} />
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </section>

            )}
          </div>

          {/* ── INPUT AREA ── */}
          <div className="flex-shrink-0 border-t bg-white px-3 sm:px-6 py-4 sm:py-6">
            <div className="max-w-3xl mx-auto">
              {attachedFiles.length > 0 && (
                <div className="mb-2 flex gap-2 flex-wrap">
                  {attachedFiles.map((f, i) => (
                    <div key={i} className="relative inline-block">
                      <img
                        src={URL.createObjectURL(f)}
                        alt={f.name}
                        className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl object-cover border border-gray-200 shadow-sm"
                      />
                      <button
                        onClick={() =>
                          setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        className="absolute -top-1.5 -right-1.5 bg-gray-800 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-500 transition"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center rounded-full border bg-white px-2 sm:px-3 shadow-lg gap-1">
                {/* Plus / attach */}
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() => setPopupOpen((o) => !o)}
                    className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-[#0A2A8B] hover:text-[#0A2A8B] transition relative"
                  >
                    <Plus size={16} />
                    {pendingFiles.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-[#0A2A8B] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-medium">
                        {pendingFiles.length}
                      </span>
                    )}
                  </button>

                  {popupOpen && (
                    <div className="absolute bottom-12 left-0 z-20 w-60 sm:w-64 rounded-2xl border bg-white shadow-xl p-4">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Lampirkan Gambar
                      </p>
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleFiles(e.dataTransfer.files);
                        }}
                        className="border-2 border-dashed border-gray-200 rounded-xl p-4 sm:p-5 flex flex-col items-center gap-2 cursor-pointer hover:border-[#0A2A8B] hover:bg-blue-50 transition"
                      >
                        <ImageUp size={26} className="text-[#0A2A8B]" />
                        <span className="text-sm font-medium text-center">Klik atau seret gambar</span>
                        <span className="text-[11px] text-muted-foreground">PNG, JPG, GIF, WEBP</span>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleFiles(e.target.files)}
                      />
                      {pendingFiles.length > 0 && (
                        <div className="mt-3 flex flex-col gap-2 max-h-40 overflow-y-auto">
                          {pendingFiles.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5">
                              <img
                                src={URL.createObjectURL(f)}
                                alt={f.name}
                                className="w-8 h-8 rounded object-cover flex-shrink-0"
                              />
                              <span className="text-xs flex-1 truncate text-gray-700">{f.name}</span>
                              <button
                                onClick={() => removeFile(i)}
                                className="text-gray-400 hover:text-red-500 transition flex-shrink-0"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={attachImages}
                          className="bg-[#0A2A8B] hover:bg-[#081f66] text-white text-sm px-4 py-1.5 rounded-lg transition"
                        >
                          Lampirkan
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !sending) handleSubmit();
                  }}
                  placeholder="Ask Chatson anything..."
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-12 sm:h-14 text-sm"
                  disabled={sending}
                />

                <button
                  onClick={handleSubmit}
                  disabled={sending || !message.trim()}
                  className="flex-shrink-0 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-[#0A2A8B] text-white transition hover:bg-[#081f66] disabled:opacity-40"
                >
                  <SendHorizonal size={16} className="sm:hidden" />
                  <SendHorizonal size={18} className="hidden sm:block" />
                </button>
              </div>

              <p className="mt-3 text-center text-xs text-muted-foreground">
                Chatson AI can make mistakes. Consider verifying important information.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

