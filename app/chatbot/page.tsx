"use client";

import { useState, useRef } from "react";
import Link from "next/link";

import {
  Bot,
  SendHorizonal,
  Plus,
  X,
  ImageUp,
  Paperclip,
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
  const [popupOpen, setPopupOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (!message.trim()) return;

    console.log("Message:", message);
    console.log("Attached files:", attachedFiles);

    // later you can connect this to your API
    setMessage("");
    setAttachedFiles([]);
    setPendingFiles([]);
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

  return (
    <main className="min-h-screen bg-[#f6f6f7] text-black">
      {/* NAVBAR */}
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          {/* LEFT */}
          <div className="flex items-center gap-14">
            <Link href="/">
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
              onClick={() => setMessage(item)}
              className="rounded-full border bg-white px-6 py-4 text-sm shadow-sm transition hover:border-[#0A2A8B] hover:shadow-md"
            >
              {item}
            </button>
          ))}
        </div>

        {/* INPUT */}
        <div className="mt-16 w-full max-w-3xl">
          {/* Attached files bar */}
          {attachedFiles.length > 0 && (
            <div className="mb-2 flex items-center gap-2 rounded-2xl border bg-white px-4 py-2 text-sm text-muted-foreground shadow-sm">
              <Paperclip size={14} />
              <span>
                {attachedFiles.length} gambar dilampirkan:{" "}
                {attachedFiles.map((f) => f.name).join(", ")}
              </span>
            </div>
          )}

          <div className="flex items-center rounded-full border bg-white px-3 shadow-lg gap-1">
            {/* PLUS BUTTON with popup */}
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

              {/* POPUP */}
              {popupOpen && (
                <div className="absolute bottom-12 left-0 z-20 w-64 rounded-2xl border bg-white shadow-xl p-4">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Lampirkan Gambar
                  </p>

                  {/* Drop / click area */}
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

                  {/* Preview list */}
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

                  {/* Footer */}
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