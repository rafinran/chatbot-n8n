# 🗺️ ROADMAP — Epson Helpdesk AI Chatbot

Dokumen ini berisi rencana pengembangan fitur lanjutan setelah versi MVP selesai.

---

## ✅ Sudah Selesai (MVP)

- [x] RAG chatbot dengan Qdrant + Gemini Embedding
- [x] Autentikasi JWT (login, register, logout)
- [x] Admin panel — manajemen dokumen & user
- [x] Upload dokumen & re-indexing
- [x] Analisis gambar via Gemini Vision / OpenRouter
- [x] Tiket eskalasi otomatis
- [x] Laporan analisis mingguan/harian via email (Gmail SMTP)
- [x] CI/CD pipeline via Jenkins (in progress)

---

## 🚀 Prioritas Tinggi

### 1. History Chat per Conversation (Sidebar)

**Seperti Claude — beda sesi, beda conversation.**

Saat ini session key di n8n Postgres Memory memakai `user_id`, artinya semua chat satu user jadi satu thread terus. Perlu dipisah per conversation.

**Yang perlu diubah:**

- Tambah tabel `Conversation` di Prisma schema:

  ```prisma
  model Conversation {
    id        Int       @id @default(autoincrement())
    userId    Int
    title     String?   // auto-generated dari pesan pertama
    createdAt DateTime  @default(now())
    updatedAt DateTime  @updatedAt
    user      User      @relation(fields: [userId], references: [id])
  }
  ```

- Backend: endpoint `POST /api/chat/conversations` (buat baru), `GET /api/chat/conversations` (list), `DELETE /api/chat/conversations/:id`
- n8n: ubah `sessionKey` dari `user_id` menjadi `conversation_id`
- Frontend: sidebar kiri berisi daftar conversation, tombol "Chat Baru", klik conversation untuk load history

**Estimasi:** 3–5 hari

---

### 2. Optimasi Kecepatan Analisis Gambar

**Target: dari ~60 detik → di bawah 15 detik.**

Bottleneck saat ini: OpenRouter Qwen melakukan analisis verbose sebelum dikirim ke n8n.

**Solusi:**

- **Batasi output analisis maksimal 40–50 kata** via system prompt yang ketat:

  ```
  Analisis gambar ini dalam MAKSIMAL 50 kata.
  Fokus pada: jenis masalah, komponen terdampak, gejala utama.
  DILARANG menjelaskan panjang lebar. Langsung ke poin.
  ```

- **Ganti model** jika masih lambat — pertimbangkan `gemini-3.1-flash` model baru langsung (sudah ada API key, tidak perlu OpenRouter, menghilangkan 1 hop jaringan)
- **Timeout eksplisit** di backend: kalau analisis > 20 detik, kirim ke n8n tanpa hasil analisis gambar dengan flag `image_analysis_timeout: true`

**Estimasi:** 1 hari

---

### 3. Optimasi Kecepatan Response Chat

**Target: dari 10–15 detik → 5–7 detik.**

**Kemungkinan bottleneck:**

- Cold start n8n webhook (jarang dipakai → container sleep)
- Qdrant retrieval lambat
- Gemini API latency

**Yang bisa dilakukan:**

- Tambahkan keep-alive ping ke n8n webhook setiap 5 menit via cron kecil di backend
- Kurangi `contextWindowLength` di Postgres Chat Memory dari 8 → 4
- Set `hnsw_ef` di Qdrant collection lebih rendah untuk trade-off speed vs accuracy
- Pertimbangkan streaming response via SSE — user merasa lebih cepat meski total waktu sama

**Estimasi:** 2–3 hari

---

### 4. Eskalasi — Reply via Email dari Admin Panel

**Admin bisa balas tiket langsung dari popup, dikirim ke email pengguna.**

**UI yang diusulkan:**

- Klik baris tiket → popup/modal muncul
- Popup menampilkan: username, **email pengguna**, pertanyaan lengkap, alasan eskalasi
- Text area untuk ketik balasan admin
- Tombol "Kirim Balasan" → backend kirim email ke pengguna
- Status tiket otomatis berubah ke "Selesai" setelah email terkirim

**Backend:**

- Endpoint `POST /api/admin/escalations/:id/reply` dengan body `{ message: string }`
- Kirim email ke `ticket.user.email` dengan template HTML

**Perubahan tabel eskalasi:**

- Kolom "User" → tampilkan username + email (bukan hanya username)
- Klik baris → buka modal reply

**Estimasi:** 2 hari

---

### 5. Activity Log yang Lebih Detail

**Catat IP, status sukses/gagal, dan aksi yang lebih granular.**

**Rekomendasi: Express middleware** (bukan Nginx log) karena bisa dikaitkan dengan `userId` dan masuk ke laporan admin.

**Tambahan field di `ActivityLog`:**

```prisma
model ActivityLog {
  // ... field existing ...
  ipAddress  String?
  userAgent  String?
  success    Boolean @default(true)
  metadata   Json?
}
```

**Event yang perlu dicatat:**

| Event | Data |
|-------|------|
| Login berhasil | userId, IP, userAgent |
| Login gagal | username attempt, IP, success: false |
| Register berhasil | userId, IP |
| Register gagal | username attempt, IP, success: false |
| Upload dokumen | userId, filename, ukuran |
| Hapus dokumen | userId, documentId |
| Kirim laporan | userId, type |
| Eskalasi dibuat | userId, ticketId, alasan |
| Eskalasi diselesaikan | adminId, ticketId |

**Implementasi IP:** Baca `X-Forwarded-For` karena ada Nginx di depan:

```typescript
const ip = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.ip;
```

**Estimasi:** 1–2 hari

---

## 🔐 Autentikasi & Keamanan

### 6. Lupa Password

**Ya, bisa pakai Resend** — ini justru use case utama Resend (transactional email). Lebih clean dari Gmail SMTP, free tier 3.000 email/bulan lebih dari cukup untuk sistem internal.

**Flow:**

1. User input email di `/forgot-password`
2. Backend generate reset token (UUID, expire 1 jam), simpan di DB
3. Kirim email via Resend berisi link: `https://chatson.my.id/reset-password?token=xxx`
4. User klik link → input password baru
5. Backend validasi token → update password → invalidate token

**Schema tambahan:**

```prisma
model PasswordResetToken {
  id        Int       @id @default(autoincrement())
  userId    Int
  token     String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  user      User      @relation(fields: [userId], references: [id])
}
```

**Estimasi:** 2 hari

---

### 7. Verifikasi Email saat Register

**Ya, bisa pakai Resend** — tinggal tambah satu template email lagi di project yang sama.

**Flow:**

1. Register → akun dibuat dengan `isVerified: false`
2. Email verifikasi dikirim via Resend
3. User klik link → akun aktif (`isVerified: true`)
4. Login hanya diizinkan kalau `isVerified: true`

**Catatan khusus untuk konteks internal Epson:** Kalau semua user adalah karyawan dengan email kantor yang sudah terverifikasi, pertimbangkan alternatif yang lebih simpel: **admin approve akun baru** dari admin panel, tanpa perlu flow email. Lebih masuk akal untuk sistem internal tertutup.

**Estimasi:** 2 hari

---

## 💡 Saran Tambahan

### 8. Filter Pertanyaan Tidak Relevan (Anti-Noise)

**Masalah:** Pertanyaan seperti *"Siapa presiden ke-7 Indonesia"* masuk ke eskalasi dan mengotori data laporan — memang cukup mengganggu.

**Solusi:**

- Tambahkan layer klasifikasi sebelum RAG di n8n: cek apakah pertanyaan berkaitan dengan printer/tinta/Epson
- Kalau tidak relevan, langsung balas tanpa hit Qdrant:

  ```
  "Maaf, saya hanya dapat membantu pertanyaan seputar produk printer 
  dan tinta Epson. Untuk pertanyaan lain, silakan hubungi layanan yang sesuai."
  ```

- Tidak masuk ke eskalasi, tapi bisa dicatat sebagai `off_topic` di ActivityLog
- Pakai Gemini Flash untuk klasifikasi — murah, cepat (~1 detik)

**Estimasi:** 1 hari

---

### 9. Rate Limiting per User

Saat ini rate limiting hanya di Nginx (by IP). Perlu tambah di level user login:

```typescript
import rateLimit from "express-rate-limit";
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  max: 30,             // maks 30 pesan/menit
  keyGenerator: (req) => req.user?.id?.toString() || req.ip,
});
```

**Estimasi:** 2 jam

---

### 10. Monitoring & Alerting

- **UptimeRobot** (gratis) — ping `/api/health` setiap 5 menit, notifikasi kalau down
- **Sentry** free tier — error tracking otomatis di backend dan frontend
- **Loki + Grafana** — log aggregation ringan, bisa di VPS yang sama

---

## 📊 Estimasi Total

| Fitur | Estimasi |
|-------|----------|
| History chat sidebar | 3–5 hari |
| Optimasi analisis gambar | 1 hari |
| Optimasi kecepatan chat | 2–3 hari |
| Eskalasi reply via email | 2 hari |
| Activity log detail | 1–2 hari |
| Lupa password | 2 hari |
| Verifikasi email | 2 hari |
| Filter pertanyaan off-topic | 1 hari |
| Rate limiting per user | 2 jam |
| Monitoring | 2 jam |
| **Total** | **~15–20 hari kerja** |

---

## 🔧 Tech Debt yang Perlu Diselesaikan

1. **Jenkins CI/CD** — selesaikan permission issue (ownership folder di VPS)
2. **`ollama` dependency** — hapus `depends_on: ollama` di service n8n di `docker-compose.yaml`
3. **`N8N_CORS_ALLOWED_ORIGINS=*`** — ganti ke domain spesifik sebelum production
4. **README.md** — update, masih menyebut ChromaDB
5. **`ADMIN_PWD`** — tambahkan ke `.env.example`
6. **Multer v1 → v2** — ada known vulnerability, upgrade ke versi 2.x

---
