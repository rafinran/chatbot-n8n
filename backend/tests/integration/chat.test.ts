import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import type { Request, Response, NextFunction } from "express";

const mockGetOrCreateConversation = vi.fn().mockResolvedValue(42);
const mockAnalyzeImage = vi.fn();
const mockCallN8n = vi.fn();
const mockResolveIsAnswered = vi.fn();
const mockAppendSession = vi.fn();
const mockLogChat = vi.fn().mockResolvedValue(1);
const mockGetSession = vi.fn();
const mockListConversations = vi.fn();
const mockCreateConversation = vi.fn();
const mockDeleteConversation = vi.fn();
const mockUpdateConversationTitle = vi.fn();
const mockMaybeEscalate = vi.fn().mockResolvedValue(undefined);

vi.mock("../../src/services/chat.service.ts", () => ({
  getOrCreateConversation: mockGetOrCreateConversation,
  analyzeImage: mockAnalyzeImage,
  callN8n: mockCallN8n,
  resolveIsAnswered: mockResolveIsAnswered,
  appendSession: mockAppendSession,
  logChat: mockLogChat,
  getSession: mockGetSession,
  listConversations: mockListConversations,
  createConversation: mockCreateConversation,
  deleteConversation: mockDeleteConversation,
  updateConversationTitle: mockUpdateConversationTitle,
}));

vi.mock("../../src/services/overview.service.ts", () => ({
  maybeEscalate: mockMaybeEscalate,
}));

vi.mock("../../src/db.ts", () => ({
  default: {
    n8n_chat_histories: { findMany: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
    conversation: { findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn() },
    chatLog: { create: vi.fn(), count: vi.fn().mockResolvedValue(0) },
  },
}));

vi.mock("../../src/middleware/auth.ts", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.user = {
      id: 1, username: "testuser", email: "test@epson.com",
      fullName: "Test User", role: "USER", isActive: true,
      isVerified: true, hashedPassword: "hash", createdAt: new Date(),
    } as any;
    next();
  },
  requireAdmin: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

process.env.JWT_SECRET = "test";
process.env.GOOGLE_API_KEY = "test";
process.env.OPENCODE_API_KEY = "test";
process.env.N8N_WEBHOOK_URL = "http://localhost/test";
process.env.INDEXER_SECRET = "test";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.RESEND_API_KEY = "test";
process.env.REPORT_RECIPIENT = "test@test.com";

const supertest = await import("supertest");
const express = await import("express");
const { default: chatRouter } = await import("../../src/routes/chat.ts");

describe("Chat Integration", () => {
  let app: express.Express;

  beforeAll(() => {
    app = express.default();
    app.use(express.default.json());
    app.use("/api/chat", chatRouter);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/chat (text message)", () => {
    it("should return 400 for empty message", async () => {
      const res = await supertest.default(app).post("/api/chat").send({ message: "" });
      expect(res.status).toBe(400);
    });

    it("should return 400 for missing message", async () => {
      const res = await supertest.default(app).post("/api/chat").send({});
      expect(res.status).toBe(400);
    });

    it("should return response for valid message", async () => {
      mockCallN8n.mockResolvedValue({ answer: "Halo! Ada yang bisa dibantu?", is_answered: true });
      mockResolveIsAnswered.mockReturnValue(true);

      const res = await supertest.default(app).post("/api/chat").send({
        message: "Halo", conversationId: 42,
      });

      expect(res.status).toBe(200);
      expect(res.body.response).toBe("Halo! Ada yang bisa dibantu?");
      expect(res.body.is_answered).toBe(true);
      expect(res.body.conversationId).toBeDefined();
    });

    it("should handle unanswered messages", async () => {
      mockCallN8n.mockResolvedValue({ answer: "Maaf, pertanyaan akan diteruskan.", is_answered: false });
      mockResolveIsAnswered.mockReturnValue(false);

      const res = await supertest.default(app).post("/api/chat").send({ message: "Test" });

      expect(res.status).toBe(200);
      expect(res.body.is_answered).toBe(false);
    });
  });

  describe("POST /api/chat (with image)", () => {
    it("should handle image upload", async () => {
      mockAnalyzeImage.mockResolvedValue("Gambar menunjukkan printer error");
      mockCallN8n.mockResolvedValue({ answer: "Silakan cek cartridge.", is_answered: true });
      mockResolveIsAnswered.mockReturnValue(true);

      const fakeImage = Buffer.from("fake-image-data");
      const res = await supertest.default(app)
        .post("/api/chat")
        .field("message", "Ini gambar apa?")
        .attach("image", fakeImage, "test.jpg");

      expect(res.status).toBe(200);
      expect(res.body.imageUrl).toBeDefined();
      expect(res.body.imageUrl).toContain("/uploads/");
    });
  });

  describe("GET /api/chat/history", () => {
    it("should return empty history when no messages", async () => {
      mockGetSession.mockResolvedValue([]);
      const res = await supertest.default(app).get("/api/chat/history");
      expect(res.status).toBe(200);
      expect(res.body.history).toEqual([]);
    });

    it("should return history with messages", async () => {
      mockGetSession.mockResolvedValue([
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ]);
      const res = await supertest.default(app).get("/api/chat/history?conversationId=42");
      expect(res.status).toBe(200);
      expect(res.body.history).toHaveLength(2);
    });
  });

  describe("Conversation CRUD", () => {
    it("POST /api/chat/conversations should create new conversation", async () => {
      mockCreateConversation.mockResolvedValue({ id: 5, title: "New Chat" });
      const res = await supertest.default(app).post("/api/chat/conversations").send({});
      expect(res.status).toBe(201);
      expect(res.body.conversation.id).toBe(5);
    });

    it("GET /api/chat/conversations should list conversations", async () => {
      mockListConversations.mockResolvedValue([{ id: 1, title: "Chat 1" }, { id: 2, title: "Chat 2" }]);
      const res = await supertest.default(app).get("/api/chat/conversations");
      expect(res.status).toBe(200);
      expect(res.body.conversations).toHaveLength(2);
    });

    it("DELETE /api/chat/conversations/:id should delete conversation", async () => {
      const res = await supertest.default(app).delete("/api/chat/conversations/5");
      expect(res.status).toBe(200);
      expect(mockDeleteConversation).toHaveBeenCalledWith(5);
    });

    it("PATCH /api/chat/conversations/:id should update title", async () => {
      const res = await supertest.default(app).patch("/api/chat/conversations/1").send({ title: "Renamed" });
      expect(res.status).toBe(200);
      expect(mockUpdateConversationTitle).toHaveBeenCalledWith(1, "Renamed");
    });
  });
});
