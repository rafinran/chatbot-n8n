import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

function createMockResponse(data: any, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(data),
  };
}

const {
  sendMessage,
  getChatHistory,
  getUsers,
  getDocuments,
  getEscalations,
  replyEscalation,
  deleteUser,
  loginUser,
  registerUser,
  forgotPassword,
  resetPassword,
  verifyEmail,
} = await import("../lib/api");

describe("API Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendMessage", () => {
    it("should send POST with JSON body for text message", async () => {
      mockFetch.mockResolvedValue(createMockResponse({ response: "Hi!", is_answered: true, conversationId: 1 }));
      const result = await sendMessage({ message: "Hello" });
      expect(result.response).toBe("Hi!");
      expect(mockFetch).toHaveBeenCalledWith(`${API_BASE_URL}/chat`, expect.objectContaining({
        method: "POST",
      }));
    });

    it("should throw on API error", async () => {
      mockFetch.mockResolvedValue(createMockResponse({ error: "Invalid" }, false, 400));
      await expect(sendMessage({ message: "Test" })).rejects.toThrow();
    });
  });

  describe("getChatHistory", () => {
    it("should fetch chat history", async () => {
      mockFetch.mockResolvedValue(createMockResponse({ history: [], conversationId: 1 }));
      const result = await getChatHistory();
      expect(result.history).toEqual([]);
      expect(mockFetch).toHaveBeenCalledWith(`${API_BASE_URL}/chat/history`, expect.any(Object));
    });
  });

  describe("getUsers", () => {
    it("should fetch users list", async () => {
      mockFetch.mockResolvedValue(createMockResponse({ users: [{ id: 1, username: "admin" }] }));
      const result = await getUsers();
      expect(result.users).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(`${API_BASE_URL}/admin/users`, expect.any(Object));
    });
  });

  describe("getDocuments", () => {
    it("should fetch documents list", async () => {
      mockFetch.mockResolvedValue(createMockResponse({ documents: [{ id: 1, originalName: "manual.pdf" }] }));
      const result = await getDocuments();
      expect(result.documents).toHaveLength(1);
    });
  });

  describe("getEscalations", () => {
    it("should fetch escalations with default status", async () => {
      mockFetch.mockResolvedValue(createMockResponse({ tickets: [] }));
      const result = await getEscalations();
      expect(result.tickets).toEqual([]);
    });

    it("should fetch escalations with search parameter", async () => {
      mockFetch.mockResolvedValue(createMockResponse({ tickets: [{ id: 1, question: "Test" }] }));
      const result = await getEscalations("pending", "printer");
      expect(result.tickets).toHaveLength(1);
    });
  });

  describe("replyEscalation", () => {
    it("should send reply", async () => {
      mockFetch.mockResolvedValue(createMockResponse({ message: "Balasan terkirim." }));
      await replyEscalation(1, "Terima kasih");
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/admin/escalations/1/reply`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ message: "Terima kasih" }),
        })
      );
    });
  });

  describe("deleteUser", () => {
    it("should delete user", async () => {
      mockFetch.mockResolvedValue(createMockResponse({ message: "User berhasil dihapus." }));
      await deleteUser(5);
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/admin/users/5`,
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("forgotPassword", () => {
    it("should send forgot password request", async () => {
      mockFetch.mockResolvedValue(createMockResponse({ message: "Email terkirim." }));
      await forgotPassword("test@epson.com");
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/auth/forgot-password`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "test@epson.com" }),
        })
      );
    });
  });

  describe("resetPassword", () => {
    it("should send reset password request", async () => {
      mockFetch.mockResolvedValue(createMockResponse({ message: "Password berhasil diubah." }));
      await resetPassword("token123", "NewPass1");
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/auth/reset-password`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ token: "token123", newPassword: "NewPass1" }),
        })
      );
    });
  });

  describe("verifyEmail", () => {
    it("should send verify email request", async () => {
      mockFetch.mockResolvedValue(createMockResponse({ message: "Email terverifikasi." }));
      await verifyEmail("verify-token");
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/auth/verify-email`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ token: "verify-token" }),
        })
      );
    });
  });
});
