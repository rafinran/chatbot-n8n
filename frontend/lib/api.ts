const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export async function apiCall(
  endpoint: string,
  options: RequestInit = {}
) {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include", // Send cookies for auth
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

// Auth endpoints
export async function register(
  username: string,
  email: string,
  fullName: string,
  password: string
) {
  return apiCall("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, email, fullName, password }),
  });
}

export async function login(username: string, password: string) {
  return apiCall("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function logout() {
  return apiCall("/auth/logout", { method: "POST" });
}

export async function getCurrentUser() {
  return apiCall("/auth/me");
}

// Chat endpoints
// export async function sendMessage(message: string) {
//   return apiCall("/chat", {
//     method: "POST",
//     body: JSON.stringify({ message }),
//   });
// }

export async function sendMessage(payload: string | FormData | { message: string; conversationId?: number }) {
  const isFormData = payload instanceof FormData;
  const isObject = !isFormData && typeof payload === "object" && payload !== null;

  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: isFormData
      ? ({ credentials: "include" } as any)
      : { "Content-Type": "application/json" },
    credentials: "include",
    body: isFormData ? payload : JSON.stringify(isObject ? payload : { message: payload }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

export async function getChatHistory() {
  return apiCall("/chat/history");
}

export async function clearChatHistory() {
  return apiCall("/chat/history", { method: "DELETE" });
}

// export async function uploadImage(file: File) {
//   const formData = new FormData();
//   formData.append("file", file);

//   return fetch(`${API_BASE_URL}/chat/upload`, {
//     method: "POST",
//     body: formData,
//     credentials: "include",
//   }).then(async (res) => {
//     if (!res.ok) {
//       const error = await res.json().catch(() => ({}));
//       throw new Error(error.error || `Upload failed: ${res.status}`);
//     }
//     return res.json();
//   });
// }

// Admin endpoints
export async function getDocuments() {
  return apiCall("/admin/documents");
}

export async function uploadDocument(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/admin/documents`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Upload failed: ${response.status}`);
  }

  return response.json();
}

export async function deleteDocument(id: number) {
  return apiCall(`/admin/documents/${id}`, { method: "DELETE" });
}

export async function reindexDocument(id: number) {
  return apiCall(`/admin/documents/${id}/reindex`, { method: "POST" });
}

export async function getUsers() {
  return apiCall("/admin/users");
}

export async function toggleUserStatus(id: number, isActive: boolean) {
  return apiCall(`/admin/users/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
}

export async function updateUserRole(id: number, role: "USER" | "ADMIN") {
  return apiCall(`/admin/users/${id}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function deleteUser(id: number) {
  return apiCall(`/admin/users/${id}`, { method: "DELETE" });
}

// Report endpoints
export async function sendReport(type: "daily" | "weekly") {
  return apiCall(`/reports/send?type=${type}`, { method: "POST" });
}

// Overview endpoints
export async function getOverviewStats() {
  return apiCall("/admin/overview/stats");
}
export async function getChatVolume() {
  return apiCall("/admin/overview/chat-volume");
}
export async function getTopTopics() {
  return apiCall("/admin/overview/top-topics");
}

// Escalation endpoints
export async function getEscalationStats() {
  return apiCall("/admin/escalations/stats");
}
export async function getEscalations(status?: string, search?: string) {
  const params = new URLSearchParams();
  if (status && status !== "all") params.set("status", status);
  if (search) params.set("search", search);
  const qs = params.toString();
  return apiCall(`/admin/escalations${qs ? `?${qs}` : ""}`);
}
export async function resolveEscalation(id: number) {
  return apiCall(`/admin/escalations/${id}/resolve`, { method: "PATCH" });
}

// Conversation endpoints
export async function listConversations() {
  return apiCall("/chat/conversations");
}

export async function createConversation(title?: string) {
  return apiCall("/chat/conversations", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function deleteConversation(id: number) {
  return apiCall(`/chat/conversations/${id}`, { method: "DELETE" });
}

export async function updateConversationTitle(id: number, title: string) {
  return apiCall(`/chat/conversations/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export async function getChatHistoryByConversation(conversationId: number) {
  return apiCall(`/chat/history?conversationId=${conversationId}`);
}

export async function replyEscalation(id: number, message: string) {
  return apiCall(`/admin/escalations/${id}/reply`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export async function escalateChat(question: string) {
  return apiCall("/chat/escalate", {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

// Password reset
export async function forgotPassword(email: string) {
  return apiCall("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, newPassword: string) {
  return apiCall("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
}

// Email verification
export async function verifyEmail(token: string) {
  return apiCall("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function resendVerificationEmail(email: string) {
  return apiCall("/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}
