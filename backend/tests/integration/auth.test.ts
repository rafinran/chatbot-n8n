import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import type { Request, Response, NextFunction } from "express";

const mockRegisterUser = vi.fn();
const mockLoginUser = vi.fn();
const mockSignToken = vi.fn(() => "mock-jwt-token");
const mockSetAuthCookie = vi.fn();
const mockFormatUser = vi.fn((user: any) => ({
  username: user.username, fullName: user.fullName,
  email: user.email, role: user.role,
}));
const mockForgotPassword = vi.fn();
const mockResetPassword = vi.fn();
const mockVerifyEmail = vi.fn();
const mockLogActivityLog = vi.fn();

vi.mock("../../src/services/auth.service.ts", () => ({
  registerUser: mockRegisterUser,
  loginUser: mockLoginUser,
  signToken: mockSignToken,
  setAuthCookie: mockSetAuthCookie,
  formatUser: mockFormatUser,
  forgotPassword: mockForgotPassword,
  resetPassword: mockResetPassword,
  verifyEmail: mockVerifyEmail,
}));

vi.mock("../../src/middleware/activityLog.ts", () => ({
  logActivityLog: mockLogActivityLog,
}));

vi.mock("../../src/db.ts", () => ({
  default: {
    passwordResetToken: { findUnique: vi.fn().mockResolvedValue(null) },
    emailVerificationToken: { findUnique: vi.fn().mockResolvedValue(null) },
    user: { findUnique: vi.fn().mockResolvedValue({
      id: 1, username: "testuser", email: "test@epson.com",
      fullName: "Test User", role: "USER", isActive: true,
      isVerified: true, hashedPassword: "hash", createdAt: new Date(),
    }) },
  },
}));

vi.mock("../../src/middleware/auth.ts", () => ({
  requireAuth: (req: Request, res: Response, next: NextFunction) => {
    req.user = {
      id: 1, username: "testuser", email: "test@epson.com",
      fullName: "Test User", role: "USER", isActive: true,
      isVerified: true, hashedPassword: "hash", createdAt: new Date(),
    } as any;
    next();
  },
  requireAdmin: (req: Request, res: Response, next: NextFunction) => next(),
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
const { default: authRouter } = await import("../../src/routes/auth.ts");

describe("Auth Integration", () => {
  let app: express.Express;

  beforeAll(() => {
    app = express.default();
    app.use(express.default.json());
    app.use("/api/auth", authRouter);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/auth/register", () => {
    it("should return 400 for short username", async () => {
      const res = await supertest.default(app).post("/api/auth/register").send({
        username: "ab", email: "a@b.com", fullName: "Test", password: "Password1",
      });
      expect(res.status).toBe(400);
    });

    it("should return 400 for invalid email", async () => {
      const res = await supertest.default(app).post("/api/auth/register").send({
        username: "testuser", email: "bademail", fullName: "Test", password: "Password1",
      });
      expect(res.status).toBe(400);
    });

    it("should return 400 for password without uppercase", async () => {
      const res = await supertest.default(app).post("/api/auth/register").send({
        username: "testuser", email: "a@b.com", fullName: "Test", password: "password1",
      });
      expect(res.status).toBe(400);
    });

    it("should return 400 for password without number", async () => {
      const res = await supertest.default(app).post("/api/auth/register").send({
        username: "testuser", email: "a@b.com", fullName: "Test", password: "PasswordX",
      });
      expect(res.status).toBe(400);
    });

    it("should return 400 for short password", async () => {
      const res = await supertest.default(app).post("/api/auth/register").send({
        username: "testuser", email: "a@b.com", fullName: "Test", password: "Ab1",
      });
      expect(res.status).toBe(400);
    });

    it("should return 201 for valid registration", async () => {
      mockRegisterUser.mockResolvedValue({ username: "testuser", email: "a@b.com" });
      const res = await supertest.default(app).post("/api/auth/register").send({
        username: "testuser", email: "a@b.com", fullName: "Test", password: "Password1",
      });
      expect(res.status).toBe(201);
      expect(res.body.user.username).toBe("testuser");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should return 400 for empty credentials", async () => {
      const res = await supertest.default(app).post("/api/auth/login").send({ username: "", password: "" });
      expect(res.status).toBe(400);
    });

    it("should return 200 for valid login", async () => {
      mockLoginUser.mockResolvedValue({
        id: 1, username: "testuser", fullName: "Test User",
        email: "test@epson.com", role: "USER", isVerified: true,
      });
      const res = await supertest.default(app).post("/api/auth/login").send({
        username: "testuser", password: "PassW0rd",
      });
      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe("testuser");
      expect(mockSignToken).toHaveBeenCalled();
      expect(mockSetAuthCookie).toHaveBeenCalled();
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return user profile with status 200", async () => {
      const res = await supertest.default(app).get("/api/auth/me");
      expect(res.status).toBe(200);
      expect(res.body.username).toBeDefined();
    });
  });

  describe("POST /api/auth/forgot-password", () => {
    it("should return 400 for missing email", async () => {
      const res = await supertest.default(app).post("/api/auth/forgot-password").send({});
      expect(res.status).toBe(400);
    });

    it("should return 200 for valid email", async () => {
      mockForgotPassword.mockResolvedValue(undefined);
      const res = await supertest.default(app).post("/api/auth/forgot-password").send({ email: "test@epson.com" });
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/auth/reset-password", () => {
    it("should return 400 for missing fields", async () => {
      const res = await supertest.default(app).post("/api/auth/reset-password").send({});
      expect(res.status).toBe(400);
    });

    it("should return 400 for short password", async () => {
      const res = await supertest.default(app).post("/api/auth/reset-password").send({
        token: "tok", newPassword: "Ab1",
      });
      expect(res.status).toBe(400);
    });

    it("should return 200 for valid reset", async () => {
      mockResetPassword.mockResolvedValue(undefined);
      const res = await supertest.default(app).post("/api/auth/reset-password").send({
        token: "valid-token", newPassword: "NewPass1",
      });
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/auth/verify-email", () => {
    it("should return 400 for missing token", async () => {
      const res = await supertest.default(app).post("/api/auth/verify-email").send({});
      expect(res.status).toBe(400);
    });

    it("should return 200 for valid token", async () => {
      mockVerifyEmail.mockResolvedValue(undefined);
      const res = await supertest.default(app).post("/api/auth/verify-email").send({ token: "valid" });
      expect(res.status).toBe(200);
    });
  });
});
