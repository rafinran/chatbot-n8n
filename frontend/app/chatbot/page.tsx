"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  Bot,
  SendHorizonal,
  LogOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendMessage, getChatHistory, logout } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const suggestions = [
  "How do I replace Epson printer ink?",
  "Why are my print results blurry?",
  "Help me connect my printer to Wi-Fi",
  "How do I fix a paper jam issue?",
];

export default function ChatbotPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout: contextLogout } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load chat history on mount
  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push("/login");
      return;
    }

    loadHistory();
  }, [authLoading, user, router]);

  // const loadHistory = async () => {
  //   try {
  //     setLoading(true);
  //     const history = await getChatHistory();
  //     setMessages(history || []);
  //   } catch (err) {
  //     console.error("Failed to load chat history:", err);
  //     setMessages([]);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const loadHistory = async () => {
    try {
      setLoading(true);
      const response = await getChatHistory();
      
      // PERBAIKAN: Ambil properti 'history' di dalam objek response, 
      // karena backend mengembalikan { history: [...] }
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
    setMessage("");

    // Add user message to chat
    const newMessages: Message[] = [
      ...messages,
      { role: "user" as const, content: userMessage },
    ];
    setMessages(newMessages);
    setSending(true);

    try {
      const response = await sendMessage(userMessage);
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f6f7]">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f6f7] text-black flex flex-col">
      {/* NAVBAR */}
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-full items-center justify-between px-6">
          {/* LEFT */}
          <div className="flex items-center gap-14">
            <Link href="/chatbot">
              <h1 className="text-2xl font-bold text-[#0A2A8B] cursor-pointer">
                Chatson
              </h1>
            </Link>

            <nav className="hidden items-center gap-10 text-sm md:flex">
              <a href="#">Solutions</a>
              <a href="#">Platform</a>
              <a href="#">Enterprise</a>
              <a href="#">Pricing</a>
            </nav>
          </div>

          {/* RIGHT */}
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

      {/* CHAT CONTENT */}
      <section className="flex-1 flex flex-col items-center justify-between px-6 py-8">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            {/* BOT ICON */}
            <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-full border bg-white shadow-sm">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0A2A8B] text-white">
                <Bot size={34} />
              </div>
            </div>

            {/* TITLE */}
            <h1 className="text-center text-5xl font-bold text-[#0A2A8B]">
              Hi, I'm Chatson
            </h1>

            <p className="mt-4 text-center text-lg text-muted-foreground">
              Anything I can help with today?
            </p>

            {/* SUGGESTIONS */}
            <div className="mt-12 grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-2">
              {suggestions.map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setMessage(item);
                  }}
                  className="rounded-full border bg-white px-6 py-4 text-sm shadow-sm transition hover:border-[#0A2A8B] hover:shadow-md"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="w-full max-w-3xl flex-1 overflow-y-auto mb-6">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`mb-4 flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-xs rounded-lg px-4 py-2 ${
                    msg.role === "user"
                      ? "bg-[#0A2A8B] text-white"
                      : "bg-white border shadow-sm"
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start mb-4">
                <div className="bg-white border shadow-sm rounded-lg px-4 py-2">
                  <p className="text-sm text-gray-500">Thinking...</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* INPUT */}
        <div className="w-full max-w-3xl">
          <div className="flex items-center rounded-full border bg-white px-3 shadow-lg">
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
      </section>
    </main>
  );
}
