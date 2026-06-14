import { describe, it, expect } from "vitest";
import { RegisterSchema, LoginSchema } from "../../src/dto/auth.dto.ts";
import { SendMessageSchema } from "../../src/dto/chat.dto.ts";

describe("RegisterSchema validation", () => {
  const valid = { username: "user123", email: "user@epson.com", fullName: "John Doe", password: "PassW0rd!" };

  it("should pass with valid data", () => {
    expect(RegisterSchema.safeParse(valid).success).toBe(true);
  });

  it("should fail when username is less than 3 chars", () => {
    const r = RegisterSchema.safeParse({ ...valid, username: "ab" });
    expect(r.success).toBe(false);
  });

  it("should fail when username is more than 30 chars", () => {
    const r = RegisterSchema.safeParse({ ...valid, username: "a".repeat(31) });
    expect(r.success).toBe(false);
  });

  it("should fail when username contains special chars", () => {
    const r = RegisterSchema.safeParse({ ...valid, username: "user@name" });
    expect(r.success).toBe(false);
  });

  it("should accept username with underscore and numbers", () => {
    expect(RegisterSchema.safeParse({ ...valid, username: "user_123" }).success).toBe(true);
  });

  it("should fail when email is invalid", () => {
    expect(RegisterSchema.safeParse({ ...valid, email: "notanemail" }).success).toBe(false);
    expect(RegisterSchema.safeParse({ ...valid, email: "" }).success).toBe(false);
  });

  it("should fail when fullName is less than 2 chars", () => {
    const r = RegisterSchema.safeParse({ ...valid, fullName: "A" });
    expect(r.success).toBe(false);
  });

  it("should fail when fullName is more than 100 chars", () => {
    const r = RegisterSchema.safeParse({ ...valid, fullName: "A".repeat(101) });
    expect(r.success).toBe(false);
  });

  it("should fail when password is less than 8 chars", () => {
    const r = RegisterSchema.safeParse({ ...valid, password: "Ab1defg" });
    expect(r.success).toBe(false);
  });

  it("should fail when password has no uppercase letter", () => {
    const r = RegisterSchema.safeParse({ ...valid, password: "abcdefg1" });
    expect(r.success).toBe(false);
  });

  it("should fail when password has no number", () => {
    const r = RegisterSchema.safeParse({ ...valid, password: "AbcdEFGH" });
    expect(r.success).toBe(false);
  });

  it("should pass with minimum valid password (8 chars, 1 uppercase, 1 digit)", () => {
    expect(RegisterSchema.safeParse({ ...valid, password: "Abcdefg1" }).success).toBe(true);
  });

  it("should fail when any required field is missing", () => {
    for (const key of ["username", "email", "fullName", "password"] as const) {
      const { [key]: _, ...rest } = valid;
      expect(RegisterSchema.safeParse(rest).success).toBe(false);
    }
  });
});

describe("LoginSchema validation", () => {
  it("should pass with valid username and password", () => {
    expect(LoginSchema.safeParse({ username: "user123", password: "secret" }).success).toBe(true);
  });

  it("should fail when username is empty", () => {
    expect(LoginSchema.safeParse({ username: "", password: "secret" }).success).toBe(false);
  });

  it("should fail when password is empty", () => {
    expect(LoginSchema.safeParse({ username: "user", password: "" }).success).toBe(false);
  });

  it("should fail when username is missing", () => {
    expect(LoginSchema.safeParse({ password: "secret" }).success).toBe(false);
  });

  it("should fail when password is missing", () => {
    expect(LoginSchema.safeParse({ username: "user" }).success).toBe(false);
  });
});

describe("SendMessageSchema validation", () => {
  it("should pass with valid message", () => {
    expect(SendMessageSchema.safeParse({ message: "Hello" }).success).toBe(true);
  });

  it("should pass with message and conversationId", () => {
    expect(SendMessageSchema.safeParse({ message: "Hello", conversationId: 42 }).success).toBe(true);
  });

  it("should fail when message is empty string", () => {
    expect(SendMessageSchema.safeParse({ message: "" }).success).toBe(false);
  });

  it("should fail when message is missing", () => {
    expect(SendMessageSchema.safeParse({}).success).toBe(false);
    expect(SendMessageSchema.safeParse({ conversationId: 1 }).success).toBe(false);
  });

  it("should fail when message exceeds 5000 characters", () => {
    const r = SendMessageSchema.safeParse({ message: "a".repeat(5001) });
    expect(r.success).toBe(false);
  });

  it("should pass with message exactly 5000 characters", () => {
    expect(SendMessageSchema.safeParse({ message: "a".repeat(5000) }).success).toBe(true);
  });

  it("should fail when conversationId is negative", () => {
    expect(SendMessageSchema.safeParse({ message: "Hi", conversationId: -1 }).success).toBe(false);
  });

  it("should fail when conversationId is zero", () => {
    expect(SendMessageSchema.safeParse({ message: "Hi", conversationId: 0 }).success).toBe(false);
  });

  it("should fail when conversationId is not an integer", () => {
    expect(SendMessageSchema.safeParse({ message: "Hi", conversationId: 3.14 }).success).toBe(false);
  });
});
