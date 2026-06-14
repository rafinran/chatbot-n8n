import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import type { Request, Response, NextFunction } from "express";
import path from "path";

const mockCreateDocument = vi.fn();
const mockListDocuments = vi.fn();
const mockDeleteDocument = vi.fn();
const mockReindexDocument = vi.fn();
const mockUpdateDocumentStatus = vi.fn();
const mockListUsers = vi.fn();
const mockToggleUserStatus = vi.fn();
const mockUpdateUserRole = vi.fn();
const mockAdminDeleteUser = vi.fn();
const mockGetOverviewStats = vi.fn();
const mockGetChatVolume = vi.fn();
const mockGetTopTopics = vi.fn();
const mockGetEscalationStats = vi.fn();
const mockListEscalations = vi.fn();
const mockResolveEscalation = vi.fn();
const mockReplyToEscalation = vi.fn();

const DOCS_DIR = path.join(process.cwd(), "documents-test");
vi.mock("../../src/services/admin.service.ts", () => ({
  createDocument: mockCreateDocument,
  listDocuments: mockListDocuments,
  deleteDocument: mockDeleteDocument,
  reindexDocument: mockReindexDocument,
  updateDocumentStatus: mockUpdateDocumentStatus,
  DOCS_DIR,
  ensureDocsDir: vi.fn(),
}));

vi.mock("../../src/services/adminUser.service.ts", () => ({
  listUsers: mockListUsers,
  toggleUserStatus: mockToggleUserStatus,
  updateUserRole: mockUpdateUserRole,
  deleteUser: mockAdminDeleteUser,
}));

vi.mock("../../src/services/overview.service.ts", () => ({
  getOverviewStats: mockGetOverviewStats,
  getChatVolume: mockGetChatVolume,
  getTopTopics: mockGetTopTopics,
  getEscalationStats: mockGetEscalationStats,
  getEscalationTickets: mockListEscalations,
  resolveEscalation: mockResolveEscalation,
  replyToEscalation: mockReplyToEscalation,
  maybeEscalate: vi.fn(),
}));

vi.mock("../../src/db.ts", () => ({
  default: {
    user: { findUnique: vi.fn().mockResolvedValue({
      id: 1, username: "admin", role: "ADMIN", isActive: true,
    }) },
  },
}));

vi.mock("../../src/middleware/auth.ts", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.user = {
      id: 99, username: "admin", email: "admin@epson.com",
      fullName: "Admin", role: "ADMIN", isActive: true,
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
const { default: adminRouter } = await import("../../src/routes/admin.ts");

describe("Admin Integration", () => {
  let app: express.Express;

  beforeAll(() => {
    app = express.default();
    app.use(express.default.json());
    app.use("/api/admin", adminRouter);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/admin/users", () => {
    it("should return user list", async () => {
      mockListUsers.mockResolvedValue([
        { id: 1, username: "user1", email: "u1@epson.com", fullName: "User One", role: "USER", isActive: true },
        { id: 2, username: "user2", email: "u2@epson.com", fullName: "User Two", role: "ADMIN", isActive: true },
      ]);
      const res = await supertest.default(app).get("/api/admin/users");
      expect(res.status).toBe(200);
      expect(res.body.users).toHaveLength(2);
      expect(res.body.users[0].username).toBe("user1");
    });
  });

  describe("PATCH /api/admin/users/:id/status", () => {
    it("should return 400 for invalid ID", async () => {
      const res = await supertest.default(app).patch("/api/admin/users/abc/status").send({ isActive: false });
      expect(res.status).toBe(400);
    });

    it("should toggle user to inactive", async () => {
      const res = await supertest.default(app).patch("/api/admin/users/1/status").send({ isActive: false });
      expect(res.status).toBe(200);
      expect(mockToggleUserStatus).toHaveBeenCalledWith(1, false);
    });

    it("should toggle user to active", async () => {
      const res = await supertest.default(app).patch("/api/admin/users/2/status").send({ isActive: true });
      expect(res.status).toBe(200);
      expect(mockToggleUserStatus).toHaveBeenCalledWith(2, true);
    });
  });

  describe("PATCH /api/admin/users/:id/role", () => {
    it("should return 400 for invalid role", async () => {
      const res = await supertest.default(app).patch("/api/admin/users/1/role").send({ role: "INVALID" });
      expect(res.status).toBe(400);
    });

    it("should update user role to ADMIN", async () => {
      const res = await supertest.default(app).patch("/api/admin/users/1/role").send({ role: "ADMIN" });
      expect(res.status).toBe(200);
      expect(mockUpdateUserRole).toHaveBeenCalledWith(1, "ADMIN");
    });
  });

  describe("DELETE /api/admin/users/:id", () => {
    it("should return 400 for self-delete", async () => {
      const res = await supertest.default(app).delete("/api/admin/users/99");
      expect(res.status).toBe(400);
    });

    it("should delete another user", async () => {
      const res = await supertest.default(app).delete("/api/admin/users/5");
      expect(res.status).toBe(200);
      expect(mockAdminDeleteUser).toHaveBeenCalledWith(5);
    });
  });

  describe("GET /api/admin/documents", () => {
    it("should return document list", async () => {
      mockListDocuments.mockResolvedValue([
        { id: 1, originalName: "manual.pdf", status: "indexed", sizeBytes: 1024 },
        { id: 2, originalName: "guide.pdf", status: "processing", sizeBytes: 2048 },
      ]);
      const res = await supertest.default(app).get("/api/admin/documents");
      expect(res.status).toBe(200);
      expect(res.body.documents).toHaveLength(2);
    });
  });

  describe("GET /api/admin/escalations", () => {
    it("should return escalation list with status filter", async () => {
      mockListEscalations.mockResolvedValue([
        { id: 1, question: "Problem?", status: "pending", user: { username: "user1" } },
      ]);
      const res = await supertest.default(app).get("/api/admin/escalations?status=pending");
      expect(res.status).toBe(200);
      expect(res.body.tickets).toHaveLength(1);
    });
  });

  describe("POST /api/admin/escalations/:id/reply", () => {
    it("should return 400 for empty message", async () => {
      const res = await supertest.default(app).post("/api/admin/escalations/1/reply").send({ message: "" });
      expect(res.status).toBe(400);
    });

    it("should send reply successfully", async () => {
      const res = await supertest.default(app).post("/api/admin/escalations/1/reply").send({
        message: "Terima kasih atas laporannya.",
      });
      expect(res.status).toBe(200);
      expect(mockReplyToEscalation).toHaveBeenCalledWith(1, "Terima kasih atas laporannya.");
    });
  });

  describe("GET /api/admin/overview/stats", () => {
    it("should return overview stats", async () => {
      mockGetOverviewStats.mockResolvedValue({ totalUsers: 10, totalChats: 100 });
      const res = await supertest.default(app).get("/api/admin/overview/stats");
      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/admin/escalations/stats", () => {
    it("should return escalation stats", async () => {
      mockGetEscalationStats.mockResolvedValue({ pendingToday: 3, resolvedWeek: 5 });
      const res = await supertest.default(app).get("/api/admin/escalations/stats");
      expect(res.status).toBe(200);
      expect(res.body.pendingToday).toBe(3);
      expect(res.body.resolvedWeek).toBe(5);
    });
  });
});
