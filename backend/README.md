# Backend — Epson Helpdesk AI

Express.js + TypeScript backend server. Menangani autentikasi pengguna, chat messaging (sync & SSE streaming), admin panel, laporan otomatis, image analysis, dan integrasi dengan n8n RAG workflow.

## Struktur Folder

```
backend/
├── src/
│   ├── config/env.ts         # Environment variables
│   ├── db.ts                 # Prisma client instance
│   ├── index.ts              # Entry point: Express app, CORS, routes, keep-alive, cleanup
│   ├── controllers/          # Request handlers (business logic entry)
│   ├── services/             # Core business logic (n8n, DB queries, AI calls)
│   ├── routes/               # Express router definitions
│   ├── middleware/            # Auth, rate limit, activity log
│   ├── dto/                  # Zod validation schemas + TypeScript interfaces
│   ├── types/                # Custom type declarations (e.g. Express Request user)
│   └── utils/                # asyncHandler wrapper
├── prisma/
│   ├── schema.prisma         # Database models
│   └── seed.js               # Seed admin user
├── tests/                    # Vitest integration tests
├── Dockerfile                # Multi-stage build
└── package.json
```

## Endpoints

### Auth — `routes/auth.ts`

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| POST | `/api/auth/register` | ❌ | Registrasi user baru. Validasi username, email, password. Kirim email verifikasi via Resend. |
| POST | `/api/auth/login` | ❌ | Login dengan username atau email + password. Set cookie `access_token`. |
| POST | `/api/auth/logout` | ✅ | Hapus sesi, clear cookie. |
| GET | `/api/auth/me` | ✅ | Ambil data user yang sedang login. |
| POST | `/api/auth/forgot-password` | ❌ | Kirim email reset password (token 1 jam). |
| POST | `/api/auth/reset-password` | ❌ | Reset password dengan token. |
| POST | `/api/auth/verify-email` | ❌ | Verifikasi email dengan token (24 jam). |
| POST | `/api/auth/resend-verification` | ❌ | Kirim ulang email verifikasi. |

**Flow Autentikasi:**
- `controller/auth.controller.ts` → terima request, validasi Zod schema
- `service/auth.service.ts` → bcrypt hash password, JWT sign, kirim email via `email.service.ts`
- `middleware/auth.ts` → `requireAuth()` verify JWT dari cookie `access_token`, attach `req.user`
- `middleware/activityLog.ts` → `logActivityLog()` catat login/logout/register/verify/reset ke tabel `ActivityLog`

### Chat — `routes/chat.ts`

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| POST | `/api/chat` | ✅ | Kirim pesan (sync). Parse image (optional), call n8n webhook, return jawaban. |
| POST | `/api/chat/stream` | ✅ | Kirim pesan (SSE streaming). Token-by-token dari n8n streaming response. |
| GET | `/api/chat/history` | ✅ | Ambil history percakapan. |
| GET | `/api/chat/conversations` | ✅ | List semua percakapan user (sorted by updatedAt desc). |
| POST | `/api/chat/conversations` | ✅ | Buat percakapan baru. |
| DELETE | `/api/chat/conversations/:id` | ✅ | Hapus percakapan. |
| PATCH | `/api/chat/conversations/:id` | ✅ | Update title percakapan. |
| POST | `/api/chat/escalate` | ✅ | Eskalasi manual (thumbs down → buat escalation ticket). |
| DELETE | `/api/chat/history` | ✅ | Backward compatibility — delete percakapan aktif. |

**Image Upload Flow:**
1. `middleware/rateLimitImage.ts` → cek dulu apakah hari ini sudah 3x upload (query `ChatLog`)
2. `multer` (di route) → simpan file ke `uploads/` dengan timestamp-unique filename
3. `chat.service.ts:analyzeImage()` → baca file sebagai base64 → kirim ke OpenRouter (Gemini 3.1 Flash primary, Qwen fallback) → return deskripsi singkat (max 50 kata)
4. Deskripsi di-append ke pertanyaan sebelum dikirim ke n8n

**SSE Streaming (sendMessageStream):**
- Set header `Content-Type: text/event-stream`
- Stream token dari n8n via `callN8nStream()` async generator (parse SSE dari n8n)
- Kirim event `data: { token: "..." }` atau `data: { imageUrl: "..." }` atau `data: { done: true, isAnswered, conversationId }`
- Bersihin noise AI Agent (Thought/Action/Observation/Final Answer tags)

**isAnswered Detection (`chat.service.ts:resolveIsAnswered`):**
- Cek 25+ regex pattern (Indonesia & English) untuk deteksi jawaban tidak terjawab
- Guard: kalau jawaban < 10 karakter → false

### Admin — `routes/admin.ts`

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| POST | `/api/admin/documents` | Admin | Upload dokumen (PDF/DOCX/TXT/MD/CSV/XLSX) ke knowledge base. Mulai indexing. |
| GET | `/api/admin/documents` | Admin | List semua dokumen dengan status + uploader. |
| POST | `/api/admin/documents/:id/reindex` | Admin | Re-index dokumen yang sudah ada. |
| DELETE | `/api/admin/documents/:id` | Admin | Hapus dokumen dari DB + Qdrant. |
| PATCH | `/api/admin/documents/:id/status` | Indexer | Update status dokumen (internal — dipanggil oleh indexer service). |
| GET | `/api/admin/users` | Admin | List semua user. |
| PATCH | `/api/admin/users/:id/status` | Admin | Aktif/nonaktifkan user. |
| PATCH | `/api/admin/users/:id/role` | Admin | Ubah role user (USER/ADMIN). |
| DELETE | `/api/admin/users/:id` | Admin | Hapus user. |
| GET | `/api/admin/overview/stats` | Admin | Statistik dashboard (total chat hari ini, answer rate, pending escalation, failed docs). |
| GET | `/api/admin/overview/chat-volume` | Admin | Volume chat 7 hari terakhir (per hari). |
| GET | `/api/admin/overview/top-topics` | Admin | Top 5 topik unanswered 7 hari terakhir. |
| GET | `/api/admin/escalations` | Admin | List escalation tickets (filter by status & search). |
| GET | `/api/admin/escalations/stats` | Admin | Statistik escalation (pending hari ini, resolved minggu ini). |
| PATCH | `/api/admin/escalations/:id/resolve` | Admin | Resolve escalation ticket. |
| POST | `/api/admin/escalations/:id/reply` | Admin | Kirim balasan ke user via email + resolve. |

### Report — `routes/report.ts`

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| POST | `/api/reports/send?type=daily|weekly` | Admin | Generate & kirim laporan analisis via email (Resend). |

## Services

### `chat.service.ts`
- `getOrCreateConversation()` — ambil percakapan terbaru user, atau buat baru
- `createConversation()` — buat percakapan baru
- `listConversations()` — list percakapan user
- `deleteConversation()` — hapus percakapan
- `updateConversationTitle()` — update title (auto-generate dari pesan pertama)
- `getSession()` — ambil history percakapan dari `n8n_chat_histories`
- `appendSession()` — simpan user + assistant message; auto-truncate ke `SESSION_MAX_ROWS`; auto-update title
- `analyzeImage()` — baca file → base64 → call OpenRouter Gemini 3.1 Flash (fallback Qwen) → return deskripsi
- `callN8n()` — POST ke n8n webhook, return `{ answer, is_answered }`
- `callN8nStream()` — async generator: POST ke n8n, parse SSE, yield token per chunk
- `resolveIsAnswered()` — regex detection untuk jawaban tidak terjawab
- `logChat()` — catat chat ke tabel `ChatLog`
- `logActivity()` — catat activity ke `ActivityLog`

### `auth.service.ts`
- `registerUser()` — validasi duplikat, bcrypt hash, buat user, kirim email verifikasi
- `loginUser()` — cari user by username OR email, bcrypt compare, cek isActive & isVerified
- `logoutUser()` — log activity
- `signToken()` — JWT sign
- `setAuthCookie()` — set httpOnly cookie
- `formatUser()` — map user ke `UserResponseDto`
- `forgotPassword()` — generate UUID token, kirim email reset link
- `resetPassword()` — validasi token (expired? used?), bcrypt hash password baru
- `verifyEmail()` — validasi token, set `isVerified: true`
- `resendVerificationEmail()` — delete token lama, buat baru, kirim ulang

### `admin.service.ts`
- `createDocument()` — simpan file ke `docs-inbox/doc_{id}/` + trigger indexer + copy ke storage
- `listDocuments()` — query semua dokumen
- `deleteDocument()` — panggil indexer DELETE API, hapus dari DB
- `updateDocumentStatus()` — update status by indexer (via secret header)
- `reindexDocument()` — copy ulang file ke `docs-inbox/doc_{id}/` untuk trigger re-index

### `overview.service.ts`
- `getOverviewStats()` — hitung totalChat, answerRate, unansweredCount, pendingEscalation, failedDocs
- `getChatVolume()` — volume chat per hari dalam 7 hari (label: Min/Mon/Sel/...)
- `getTopTopics()` — top 5 pertanyaan unanswered terbanyak (group by question text)
- `getEscalationStats()` — pending hari ini, resolved minggu ini
- `getEscalationTickets()` — list escalation dengan filter status & search (fullName, email, question)
- `resolveEscalation()` — set status + timestamp
- `maybeEscalate()` — auto-create escalation kalau: unanswered, low confidence (<0.4), atau no context
- `replyToEscalation()` — kirim email balasan ke user via `email.service.ts` + resolve ticket

### `report.service.ts`
1. `queryReportData()` — query ChatLog 7 hari/hari ini → total, answered, unanswered, withImage, topUsers, questions
2. `clusterWithAI()` — kirim daftar pertanyaan ke OpenCode (DeepSeek) → AI cluster jadi 3-7 topik → return JSON
3. `buildEmailHtml()` — render HTML email dengan stats, cluster tables, top users
4. `sendEmail()` — kirim via Resend API
5. `generateAndSendReport()` — orchestrate semua step

### `email.service.ts`
- `sendEmail()` — kirim email transaksional via Resend (`noreply@chatson.my.id`)
- `sendEscalationReply()` — kirim balasan admin ke user (format HTML)

### `classifier.service.ts`
- `classifyQuestion()` — call OpenCode DeepSeek V4 Flash → klasifikasi "yes/no" apakah pertanyaan relevan dengan Epson printer
- `logOffTopic()` — catat pertanyaan off-topic ke ActivityLog

### `adminUser.service.ts`
- `getUsers()` — list semua user
- `toggleUserStatus()` — aktif/nonaktifkan
- `updateUserRole()` — ubah role
- `deleteUser()` — hapus user + cascade

## Middleware

### `middleware/auth.ts`
- `requireAuth` — baca cookie `access_token`, JWT verify, query user dari DB, attach ke `req.user`. Return 401 kalau invalid/expired/nonaktif.
- `requireAdmin` — cek `req.user.role === "ADMIN"`. Return 403 kalau bukan admin.

### `middleware/rateLimitImage.ts`
- `imageUploadLimit` — cek `Content-Type` → kalau multipart, query `ChatLog` untuk today's count → kalau >= 3, return 429.

### `middleware/activityLog.ts`
- `logActivityLog()` — catat aktivitas user (register, login, logout, verify, reset) dengan IP address + user agent.

## DTO / Validation (Zod)

- `chat.dto.ts` — `SendMessageSchema`: message (string 1-5000), conversationId (coerced positive int, optional)
- `auth.dto.ts` — `RegisterSchema`: username (alphanumeric 3-30), email, fullName (2-100), password (min 8, uppercase + digit). `LoginSchema`: username, password
- `admin.dto.ts` — `UpdateStatusSchema`: status enum. `ALLOWED_MIMETYPES`: PDF/DOCX/TXT/MD/CSV/XLSX
- `password.dto.ts` — `ForgotPasswordSchema`, `ResetPasswordSchema`
- `email-verification.dto.ts` — `VerifyEmailSchema`, `ResendVerificationEmailSchema`

## Environment Variables (`config/env.ts`)

| Variable | Required | Default | Deskripsi |
|----------|----------|---------|-----------|
| `PORT` | ❌ | 8000 | Port backend |
| `NODE_ENV` | ❌ | development | Environment |
| `JWT_SECRET` | ✅ | — | Secret key JWT |
| `FRONTEND_URL` | ❌ | http://localhost:80 | CORS origin |
| `DATABASE_URL` | ✅ | — | PostgreSQL connection |
| `N8N_WEBHOOK_URL` | ✅ | — | n8n workflow webhook |
| `GOOGLE_API_KEY` | ✅ | — | Google AI (legacy) |
| `OPENCODE_API_KEY` | ✅ | — | OpenCode API key |
| `OPENROUTER_API_KEY` | ❌ | — | OpenRouter API key |
| `INDEXER_URL` | ❌ | http://indexer:5000 | Indexer service URL |
| `INDEXER_SECRET` | ✅ | — | Secret untuk indexer callback |
| `RESEND_API_KEY` | ✅ | — | Resend API key (email) |
| `REPORT_RECIPIENT` | ✅ | — | Email penerima laporan |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | ❌ | — | Gmail SMTP (fallback, gak dipake) |

## Background Jobs (`index.ts`)

1. **Keep-alive n8n** — setiap 1 jam: kirim `[KEEPALIVE]` request ke n8n untuk mencegah cold start
2. **Cleanup keep-alive history** — setiap 2 jam: hapus entry `n8n_chat_histories` yang mengandung `[KEEPALIVE]`
3. **Cleanup uploads** — setiap 6 jam: hapus file di `uploads/` yang lebih dari 7 hari
4. **Health check** — `GET /api/health`: cek database (SELECT 1) + indexer (/health endpoint)
