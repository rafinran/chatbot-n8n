import { describe, it, expect, vi, beforeEach } from "vitest";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    _store: store,
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

type FeedbackState = "idle" | "satisfied" | "escalated";

function getInitialFeedbackState(messageId: string): FeedbackState {
  const stored = localStorage.getItem(`feedback_${messageId}`);
  return (stored as FeedbackState) || "idle";
}

function persistFeedbackState(messageId: string, state: FeedbackState) {
  localStorage.setItem(`feedback_${messageId}`, state);
}

describe("FeedbackButtons persistence logic", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("should return idle for new message", () => {
    const state = getInitialFeedbackState("msg-1");
    expect(state).toBe("idle");
  });

  it("should persist satisfied state", () => {
    persistFeedbackState("msg-1", "satisfied");
    expect(getInitialFeedbackState("msg-1")).toBe("satisfied");
  });

  it("should persist escalated state", () => {
    persistFeedbackState("msg-2", "escalated");
    expect(getInitialFeedbackState("msg-2")).toBe("escalated");
  });

  it("should override previous state when switching feedback", () => {
    persistFeedbackState("msg-3", "satisfied");
    persistFeedbackState("msg-3", "escalated");
    expect(getInitialFeedbackState("msg-3")).toBe("escalated");
  });

  it("should keep different message feedbacks separate", () => {
    persistFeedbackState("msg-a", "satisfied");
    persistFeedbackState("msg-b", "escalated");
    expect(getInitialFeedbackState("msg-a")).toBe("satisfied");
    expect(getInitialFeedbackState("msg-b")).toBe("escalated");
  });

  it("should clear feedback when localStorage is cleared", () => {
    persistFeedbackState("msg-1", "satisfied");
    localStorage.clear();
    expect(getInitialFeedbackState("msg-1")).toBe("idle");
  });
});
