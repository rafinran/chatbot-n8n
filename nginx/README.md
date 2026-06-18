# Nginx — Epson Helpdesk AI

Nginx sebagai reverse proxy untuk seluruh aplikasi.

```
nginx/
├── nginx.conf    # Konfigurasi utama
└── Dockerfile    # nginx:alpine
```

## Arsitektur

```
Internet → Nginx (port 80) → Frontend (Next.js :3000)
                           → Backend (Express :8000)
                           → Static uploads (/uploads → backend)
```

## Fitur

### 1. HTTP (Port 80) — Single Server
Semua traffic masuk lewat port 80 tanpa SSL. Server name wildcard (`_`).

### 2. Rate Limiting (nginx level)

| Zone | Rate | Burst | Target |
|------|------|-------|--------|
| `login` | 5 req/min | 3 | `/api/auth/login` — cegah brute force |
| `chat` | 20 req/min | 5 | `/api/chat` — cegah spam chat |
| `upload` | 8 req/min | 2 | `/api/admin/documents` — cegah upload berlebihan |

Semua rate limit menggunakan `$binary_remote_addr` sebagai key dengan shared memory zone 10MB.

### 3. Reverse Proxy Rules

| Location | Target | Rate Limiting | Deskripsi |
|----------|--------|---------------|-----------|
| `/` | `http://frontend:3000` | ❌ | Frontend Next.js (SSR + static) |
| `/api/auth/login` | `http://backend:8000` | ✅ login | Login endpoint (brute force protection) |
| `/api/chat` | `http://backend:8000` | ✅ chat | Chat messaging + streaming |
| `/api/admin/documents` | `http://backend:8000` | ✅ upload | Document upload admin |
| `/uploads` | `http://backend:8000` | ❌ | Static image serving dari backend |
| `/api` (fallback) | `http://backend:8000` | ❌ | Backend API lainnya (auth, admin, report, health) |
| `/nginx-health` | internal | ❌ | Health check nginx |

### 4. HTTP Header Forwarding

Semua proxy location mengirim header berikut ke backend:
- `X-Real-IP` — IP asli client
- `X-Forwarded-For` — chain IP
- `X-Forwarded-Proto` — protocol (http/https)
- `Cookie` + `Set-Cookie` — untuk auth session

Timeout:
- `proxy_read_timeout: 120s` — support SSE streaming
- `proxy_connect_timeout: 10s`

### 5. Client Max Body Size
`client_max_body_size 50M` — mendukung upload dokumen admin (max 50MB per file).

## Dockerfile

```dockerfile
FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
```

Nginx dijalankan via docker-compose dengan port mapping `80:80`.

## Catatan

1. **Rate limit di nginx vs backend:** nginx rate limit adalah lapisan pertama (IP-based). Backend juga punya `express-rate-limit` (user-based). Keduanya aktif secara independen.
2. **Jangan ubah `proxy_read_timeout` < 120s** — SSE streaming butuh koneksi panjang.
3. **CORS:** Backend Express juga handle CORS (check origin). Nginx hanya forward headers.
