# Frontend — Epson Helpdesk AI (Next.js)

Next.js 16 frontend untuk chatbot helpdesk Epson dan admin panel. SSR + Client Components dengan Tailwind CSS.

```
frontend/
├── app/
│   ├── layout.tsx            # Root layout: font Inter, Providers wrapper
│   ├── page.tsx              # Landing page (hero, features, footer, chatbot button)
│   ├── providers.tsx         # AuthProvider wrapper
│   ├── globals.css           # Tailwind base styles
│   ├── login/page.tsx        # Login page (username/email + password)
│   ├── register/page.tsx     # Register page (username, email, fullName, password)
│   ├── chatbot/page.tsx      # Chat page (messaging, streaming, image upload)
│   ├── admin/page.tsx        # Admin panel (overview, documents, users, escalations)
│   ├── forgot-password/      # Reset password request
│   ├── reset-password/       # Reset password form
│   ├── verify-email/         # Email verification handler
│   └── api/                  # API route handlers (if any)
├── components/
│   ├── ConversationSidebar.tsx  # Sidebar percakapan (search, group by date, CRUD)
│   └── ui/                     # shadcn/ui components (button, input, card, etc.)
├── lib/
│   ├── api.ts                # API client functions (auth, chat, admin, reports)
│   ├── auth-context.tsx       # React context for auth state (user, login, logout)
│   └── utils.ts              # cn() helper (clsx + tailwind-merge)
├── __tests__/                # Vitest tests
├── public/                   # Static assets
├── Dockerfile                # Multi-stage build
└── package.json
```

## Pages

### Landing Page (`/` — `app/page.tsx`)
- Hero section dengan tagline "Enterprise AI. Engineered for Precision."
- Feature grid (6 items: AI Models, Integration, Security, Developer APIs, Analytics, Enterprise)
- Footer dengan produk, support, company, newsletter
- Floating chatbot button (fixed bottom-right) → navigate ke `/chatbot` atau `/login`
- Navbar dengan link Solutions/Platform/Enterprise/Pricing/Industries/Support
- Admin button (visible kalau user role ADMIN)
- Mobile hamburger menu

### Login (`/login` — `app/login/page.tsx`)
- Form: input username/email + password
- Link ke register, forgot password
- Setelah login → redirect ke `/chatbot`

### Register (`/register` — `app/register/page.tsx`)
- Form: username, email, fullName, password
- Validasi client-side
- Setelah register → info cek email untuk verifikasi

### Chat (`/chatbot` — `app/chatbot/page.tsx`)
**Fitur:**
- **ConversationSidebar** — sidebar kiri dengan daftar percakapan (group by: Hari ini/Kemarin/7 hari/30 hari/Lebih lama), search, new chat, delete with confirm popover
- **Skeleton loading** — animated pulse placeholder saat loading history
- **Messaging** — input text + send button; suggestions (4 default: refill ink, blurry print, Wi-Fi, paper jam)
- **Image upload** — tombol kamera → file picker → preview thumbnail; kirim bersama pesan
- **SSE Streaming** — token-by-token rendering via `sendMessageStream()`, ReadableStream SSE parser
- **Persistent image URL** — blob → server path replacement setelah upload
- **Feedback buttons** — ThumbsUp / ThumbsDown per pesan; simpan di localStorage
- **Manual escalation** — kalau ThumbsDown → POST ke `/api/chat/escalate`
- **Markdown rendering** — jawaban assistant di-render via `react-markdown` + `remark-gfm` (tables, lists, links)
- **Loading baru** — bouncing dots animation (3 dots bergantian) saat menunggu response
- **Protected route** — redirect ke `/login` kalau tidak authenticated

### Admin (`/admin` — `app/admin/page.tsx`)
**Tabs:**
- **Overview** — 4 KPI cards (Total Chat, Answer Rate, Pending Escalation, Failed Docs) + Bar chart volume 7 hari + Top 5 Topics table + Escalation Stats cards
- **Documents** — Upload form (drag & click), table dengan status (processing → indexed/failed), reindex & delete actions
- **Users** — Table users dengan role (USER/ADMIN), status toggle, delete
- **Escalations** — Table escalation tickets dengan status filter, search, reply modal, resolve button
- **Report** (di tab Overview atau terpisah) — Kirim laporan daily/weekly via email

**Responsive design:** navbar tabs collapse ke scrollable container, cards single-column di mobile, tables horizontal scroll via `overflow-x-auto`

## API Client (`lib/api.ts`)

Semua fungsi API dikelompokkan berdasarkan domain:

- `apiCall()` — base fetch wrapper: attach JSON Content-Type, credentials `include`, error handling
- **Auth:** `register()`, `login()`, `logout()`, `getCurrentUser()`
- **Chat (sync):** `sendMessage(payload)` — accept string, object, atau FormData
- **Chat (stream):** `sendMessageStream(payload, onToken, onImageUrl)` — SSE stream reader, return `{ isAnswered, conversationId }`
- **Chat history:** `getChatHistory()`, `getChatHistoryByConversation()`, `clearChatHistory()`
- **Conversation:** `listConversations()`, `createConversation()`, `deleteConversation()`, `updateConversationTitle()`
- **Admin docs:** `getDocuments()`, `uploadDocument()`, `deleteDocument()`, `reindexDocument()`
- **Admin users:** `getUsers()`, `toggleUserStatus()`, `updateUserRole()`, `deleteUser()`
- **Admin overview:** `getOverviewStats()`, `getChatVolume()`, `getTopTopics()`
- **Admin escalations:** `getEscalations()`, `getEscalationStats()`, `resolveEscalation()`, `replyEscalation()`
- **Report:** `sendReport(type)`
- **Password:** `forgotPassword()`, `resetPassword()`
- **Email verification:** `verifyEmail()`, `resendVerificationEmail()`

## Auth Context (`lib/auth-context.tsx`)

React context (`AuthContext`) menyediakan:
- `user` — objek user (null kalau belum login)
- `loading` — true saat fetching auth status
- `error` — error message
- `login(user)` — set user state
- `logout()` — panggil `/api/auth/logout`, clear state
- `checkAuth()` — fetch `/api/auth/me` → set user/null

`useAuth()` hook — wrapper untuk consume context. Throw error kalau dipakai di luar `AuthProvider`.

## Component UI (`components/ui/`)

shadcn/ui components:
- `button.tsx` — Button dengan variants (default, outline, ghost, destructive)
- `input.tsx` — Styled input field
- `card.tsx` — Card, CardHeader, CardTitle, CardContent, CardFooter
- `checkbox.tsx` — Checkbox
- `dialog.tsx` — Modal dialog
- `separator.tsx` — Horizontal separator

## Build & Deploy

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
CMD ["npm", "start"]
```

- `next.config.ts` — minimal config (kosong, default)
- `Dockerfile` — multi-stage build: install deps → build → production image
