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

export async function sendMessage(payload: string | FormData) {
  const isFormData = payload instanceof FormData;

  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    // kalau FormData, JANGAN set Content-Type — browser otomatis set boundary-nya
    headers: isFormData 
      ? { credentials: "include" } as any
      : { "Content-Type": "application/json" },
    credentials: "include",
    body: isFormData ? payload : JSON.stringify({ message: payload }),
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
