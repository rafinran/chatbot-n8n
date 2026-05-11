"use client";

import { useState } from "react";
import Link from "next/link";

import {
  Bot,
  SendHorizonal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const suggestions = [
  "How do I replace Epson printer ink?",
  "Why are my print results blurry?",
  "Help me connect my printer to Wi-Fi",
  "How do I fix a paper jam issue?",
];

export default function ChatbotPage() {
  const [message, setMessage] = useState("");

  const handleSubmit = () => {
    if (!message.trim()) return;

    console.log("Message:", message);

    // later you can connect this to your API
    setMessage("");
  };

  return (
    <main className="min-h-screen bg-[#f6f6f7] text-black">
      {/* NAVBAR */}
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          {/* LEFT */}
          <div className="flex items-center gap-14">
            <Link href="/">
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
            <Link href="/login">
              <button className="text-sm font-medium hover:text-[#0A2A8B] transition">
                Login
              </button>
            </Link>

            <Button className="bg-[#0A2A8B] hover:bg-[#081f66] rounded-md px-5">
              Book a Demo
            </Button>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <section className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center px-6">
        {/* BOT ICON */}
        <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-full border bg-white shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0A2A8B] text-white">
            <Bot size={34} />
          </div>
        </div>

        {/* TITLE */}
        <h1 className="text-center text-5xl font-bold text-[#0A2A8B]">
          Hi, I’m Chatson
        </h1>

        <p className="mt-4 text-center text-lg text-muted-foreground">
          Anything I can help with today?
        </p>

        {/* SUGGESTIONS */}
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

        {/* INPUT */}
        <div className="mt-16 w-full max-w-3xl">
          <div className="flex items-center rounded-full border bg-white px-3 shadow-lg">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSubmit();
                }
              }}
              placeholder="Ask Chatson anything..."
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-14"
            />

            <button
              onClick={handleSubmit}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0A2A8B] text-white transition hover:bg-[#081f66]"
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