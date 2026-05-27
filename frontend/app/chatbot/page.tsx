"use client";

import ReactMarkdown from "react-markdown";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  Bot,
  SendHorizonal,
  Plus,
  X,
  ImageUp,
  Paperclip,
  Search,
  MessageSquare,
  SquarePen,
  LogOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendMessage, getChatHistory, logout } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface Message {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
}

const suggestions = [
  "How do I replace Epson printer ink?",
  "Why are my print results blurry?",
  "Help me connect my printer to Wi-Fi",
  "How do I fix a paper jam issue?",
];

const recentChats = [
  { id: 1, title: "Printer ink replacement guide", time: "Just now" },
  { id: 2, title: "Wi-Fi connection troubleshoot", time: "2 hours ago" },
  { id: 3, title: "Blurry print quality fix", time: "Yesterday" },
  { id: 4, title: "Paper jam on Epson L3210", time: "Yesterday" },
  { id: 5, title: "How to clean print heads", time: "2 days ago" },
  { id: 6, title: "Driver installation Windows 11", time: "3 days ago" },
  { id: 7, title: "Ink cartridge not detected", time: "Last week" },
];

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
  const [searchQuery, setSearchQuery] = useState("");
  const [activeChat, setActiveChat] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push("/login");
      return;
    }

    loadHistory();
  }, [authLoading, user, router]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const response = await getChatHistory();
      
      if (response && response.history && Array.isArray(response.history)) {
        setMessages(response.history);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to load chat history:", err);
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

    setMessage("");
    setPopupOpen(false);

    const newMessages: Message[] = [
      ...messages,
      { role: "user" as const, content: userMessage, imageUrl: imagePreviewUrl },
    ];
    setMessages(newMessages);
    setSending(true);

    try {
      let response;
      if (imageFile) {
        const formData = new FormData();
        formData.append("message", userMessage);
        formData.append("image", imageFile);
        response = await sendMessage(formData);
      } else {
        response = await sendMessage(userMessage);
      }

      newMessages.push({
        role: "assistant" as const,
        content: response.response,
      });
      setMessages([...newMessages]);
    } catch (err: any) {
      newMessages.push({
        role: "assistant" as const,
        content: `Error: ${err.message || "Failed to send message"}`,
      });
      setMessages([...newMessages]);
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

  const removeFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const attachImages = () => {
    setAttachedFiles([...pendingFiles]);
    setPopupOpen(false);
  };

  const filteredChats = recentChats.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f6f7]">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#f6f6f7] text-black overflow-hidden">
      {/* NAVBAR */}
      <header className="border-b bg-white z-10 flex-shrink-0">
        <div className="mx-auto flex h-16 max-w-full items-center justify-between px-6">
          <div className="flex items-center gap-14">
            <Link href="/chatbot">
              <h1 className="text-2xl font-bold text-[#0A2A8B] cursor-pointer">
                Webson & Chatson
              </h1>
            </Link>

            <nav className="hidden items-center gap-10 text-sm md:flex">
              <a href="#">Solutions</a>
              <a href="#">Platform</a>
              <a href="#">Enterprise</a>
              <a href="#">Pricing</a>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user?.fullName || user?.username}
            </span>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm font-medium hover:text-[#0A2A8B] transition"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <aside className="w-64 flex-shrink-0 bg-white border-r flex flex-col h-full">
          <div className="p-3 flex-shrink-0">
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#0A2A8B] hover:bg-[#f0f4ff] transition group">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0A2A8B] text-white group-hover:bg-[#081f66] transition flex-shrink-0">
                <SquarePen size={14} />
              </span>
              New Chat
            </button>
          </div>

          <div className="px-3 pb-3 flex-shrink-0">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-[#f6f6f7] px-3 py-2 text-sm">
              <Search size={14} className="text-gray-400 flex-shrink-0" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
                className="bg-transparent outline-none w-full text-sm text-gray-700 placeholder:text-gray-400"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-4">
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Recents
            </p>

            <div className="flex flex-col gap-0.5">
              {filteredChats.length > 0 ? (
                filteredChats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => setActiveChat(chat.id)}
                    className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition w-full group ${
                      activeChat === chat.id
                        ? "bg-[#e8edf8] text-[#0A2A8B]"
                        : "hover:bg-[#f6f6f7] text-gray-700"
                    }`}
                  >
                    <MessageSquare
                      size={14}
                      className={`mt-0.5 flex-shrink-0 ${
                        activeChat === chat.id
                          ? "text-[#0A2A8B]"
                          : "text-gray-400 group-hover:text-gray-500"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm leading-snug">
                        {chat.title}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {chat.time}
                      </p>
                    </div>
                  </button>
                ))
              ) : (
                <p className="px-2 py-4 text-xs text-gray-400 text-center">
                  No chats found
                </p>
              )}
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <section className="flex min-h-full flex-col items-center justify-center px-6 py-12">
                <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-full border bg-white shadow-sm">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0A2A8B] text-white">
                    <Bot size={34} />
                  </div>
                </div>

                <h1 className="text-center text-5xl font-bold text-[#0A2A8B]">
                  Hi, I'm Chatson
                </h1>

                <p className="mt-4 text-center text-lg text-muted-foreground">
                  Anything I can help with today?
                </p>

                <div className="mt-12 grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-2">
                  {suggestions.map((item) => (
                    <button
                      key={item}
                      onClick={() => setMessage(item)}
                      className="rounded-full border bg-white px-6 py-4 text-sm shadow-sm transition hover:border-[#0A2A8B] hover:shadow-md"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </section>
            ) : (
              <section className="px-6 py-8">
                <div className="max-w-3xl mx-auto space-y-6">
                  {messages.map((msg, idx) => (
                    <div key={idx}>
                      {msg.role === "user" ? (
                        /* USER BUBBLE — 75% width, right-aligned, dengan preview gambar */
                        <div className="flex justify-end">
                          <div className="max-w-[75%] flex flex-col items-end gap-2">
                            {msg.imageUrl && (
                              <img
                                src={msg.imageUrl}
                                alt="uploaded"
                                className="max-h-60 rounded-2xl object-cover border border-white/20 shadow"
                              />
                            )}
                            <div className="rounded-2xl bg-[#0A2A8B] px-5 py-3 text-white">
                              <p className="text-sm leading-relaxed">{msg.content}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* ASSISTANT — markdown rendered, Claude-style */
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#0A2A8B] text-white">
                            <Bot size={14} />
                          </div>
                          <div className="flex-1 text-sm leading-relaxed text-gray-800 prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ul:pl-5 prose-ul:list-disc prose-ol:my-1 prose-ol:pl-5 prose-ol:list-decimal prose-li:my-0.5 prose-strong:font-semibold prose-strong:text-gray-900">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {sending && (
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#0A2A8B] text-white">
                        <Bot size={14} />
                      </div>
                      <p className="text-sm text-gray-400 italic">Thinking...</p>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* INPUT AREA */}
          <div className="flex-shrink-0 border-t bg-white px-6 py-8">
            <div className="max-w-3xl mx-auto">
              {attachedFiles.length > 0 && (
                <div className="mb-2 flex gap-2 flex-wrap">
                  {attachedFiles.map((f, i) => (
                    <div key={i} className="relative inline-block">
                      <img
                        src={URL.createObjectURL(f)}
                        alt={f.name}
                        className="h-20 w-20 rounded-xl object-cover border border-gray-200 shadow-sm"
                      />
                      <button
                        onClick={() => setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-1.5 -right-1.5 bg-gray-800 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-500 transition"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center rounded-full border bg-white px-3 shadow-lg gap-1">
                <div className="relative">
                  <button
                    onClick={() => setPopupOpen((o) => !o)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-[#0A2A8B] hover:text-[#0A2A8B] transition relative flex-shrink-0"
                  >
                    <Plus size={18} />
                    {pendingFiles.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-[#0A2A8B] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-medium">
                        {pendingFiles.length}
                      </span>
                    )}
                  </button>

                  {popupOpen && (
                    <div className="absolute bottom-12 left-0 z-20 w-64 rounded-2xl border bg-white shadow-xl p-4">
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
                        className="border-2 border-dashed border-gray-200 rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer hover:border-[#0A2A8B] hover:bg-blue-50 transition"
                      >
                        <ImageUp size={28} className="text-[#0A2A8B]" />
                        <span className="text-sm font-medium text-center">
                          Klik atau seret gambar
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          PNG, JPG, GIF, WEBP
                        </span>
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
                        <div className="mt-3 flex flex-col gap-2">
                          {pendingFiles.map((f, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5"
                            >
                              <img
                                src={URL.createObjectURL(f)}
                                alt={f.name}
                                className="w-8 h-8 rounded object-cover flex-shrink-0"
                              />
                              <span className="text-xs flex-1 truncate text-gray-700">
                                {f.name}
                              </span>
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
                    if (e.key === "Enter" && !sending) {
                      handleSubmit();
                    }
                  }}
                  placeholder="Ask Chatson anything..."
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-14"
                  disabled={sending}
                />

                <button
                  onClick={handleSubmit}
                  disabled={sending}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0A2A8B] text-white transition hover:bg-[#081f66] disabled:opacity-50"
                >
                  <SendHorizonal size={18} />
                </button>
              </div>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                Chatson AI can make mistakes. Consider verifying
                important information.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
