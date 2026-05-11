const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
 
const req = (method, path, body, isFormData = false) =>
  fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers: isFormData ? undefined : { "Content-Type": "application/json" },
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  }).then(async (res) => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Terjadi kesalahan.");
    return data;
  });
 
export const api = {
  login:        (username, password) => req("POST",   "/auth/login",    { username, password }),
  logout:       ()                   => req("POST",   "/auth/logout"),
  me:           ()                   => req("GET",    "/auth/me"),
  register:     (body)               => req("POST",   "/auth/register", body),
  chat:         (message)            => req("POST",   "/chat",          { message }),
  getHistory:   ()                   => req("GET",    "/chat/history"),
  clearHistory: ()                   => req("DELETE", "/chat/history"),
  chatWithImage: (message, file) => {
    const form = new FormData();
    form.append("message", message);
    form.append("image", file);
    return req("POST", "/chat/upload", form, true);
  },
};
 