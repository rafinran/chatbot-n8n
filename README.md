# Epson Helpdesk AI

Chatbot helpdesk internal berbasis **Retrieval Augmented Generation (RAG)** untuk troubleshooting printer dan tinta Epson. Jawaban diambil dari knowledge base yang diindeks ke Qdrant, bukan dari pengetahuan umum LLM.

---

## Arsitektur

```
┌─────────────────────────────────────────────────────────────┐
│                       User Browser                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
        ┌──────────────────────────────┐
        │   Nginx (Port 80 / 443)      │
        │   Reverse Proxy + Rate Limit │
        │   Let's Encrypt (certbot)    │
        └──┬──────────────────────────┬┘
           │                          │
           ▼                          ▼
    ┌─────────────────┐      ┌──────────────────┐
    │   Frontend      │      │     Backend      │
    │   Next.js 14    │      │  Express + TS    │
    │   Port :3000    │      │   Port :8000     │
    └─────────────────┘      └────────┬─────────┘
                                      │
                     ┌────────────────┼────────────────┐
                     ▼                ▼                ▼
              ┌─────────────┐  ┌─────────────┐  ┌──────────────┐
              │ PostgreSQL  │  │    n8n      │  │   Indexer    │
              │ Port :5432  │  │ Port :5678  │  │  Port :5000  │
              │ Auth, Logs  │  │  RAG Flow   │  │   FastAPI    │
              │ Eskalasi    │  │             │  │   Python     │
              └─────────────┘  └──────┬──────┘  └────────┬─────┘
                                      │                  │
                                      └─────────┬────────┘
                                                ▼
                                    ┌──────────────────────┐
                                    │   Qdrant Vector DB   │
                                    │     Port :6333       │
                                    │ knowledge_base_epson │
                                    └──────────────────────┘
```

| Service    | Teknologi                             | Fungsi                                                      |
|------------|---------------------------------------|-------------------------------------------------------------|
| `nginx`    | Nginx + Let's Encrypt (certbot)       | Reverse proxy, HTTPS, rate limiting                         |
| `frontend` | Next.js 14 + Tailwind CSS + shadcn/ui | UI chatbot, halaman admin           |
| `backend`  | Express + TypeScript + Prisma ORM     | API gateway, auth JWT, chat, document management, reporting |
| `db`       | PostgreSQL 16                         | User, dokumen, chat log, activity log, eskalasi tiket       |
| `indexer`  | FastAPI + Python                      | Ekstraksi teks, chunking, embedding ke Qdrant               |
| `qdrant`   | Qdrant                                | Vector database (`knowledge_base_epson`)                    |
| `n8n`      | n8n                                   | Orkestrasi RAG workflow (AI Agent + Vector Search)          |
| `ollama`   | Ollama                                | Gunakan jika mau menggunakan model lokal (opsional)         |
---

## Prasyarat

- Docker & Docker Compose v2
- **Google Gemini API Key** (wajib, untuk embedding) → [aistudio.google.com](https://aistudio.google.com/app/apikey)
- **OpenCode API Key** (wajib, untuk LLM text & image) → [opencode.ai](https://opencode.ai)
- **OpenRouter API Key** *(opsional, fallback)* → [openrouter.ai](https://openrouter.ai)
- **Resend API Key** *(opsional, untuk email report)* → [resend.com](https://resend.com)
---

## Instalasi

```bash
# 1. Clone & setup env
git clone https://github.com/rafinran/chatbot-n8n && cd chatbot-n8n
mv .env.example .env   # isi minimal: GOOGLE_API_KEY, OPENCODE_API_KEY, JWT_SECRET, ADMIN_PWD

# 2. Jalankan semua service
docker compose up --build -d

# 3. Setup database
docker exec helpdesk-backend npx prisma db push
docker exec helpdesk-backend npx prisma db seed
```

**Import workflow n8n:**

1. Buka `http://localhost:5678` (SSH tunnel jika port tertutup)
2. Buat credential: Qdrant (`http://qdrant:6333`), PostgreSQL (host `db`), OpenCode (OpenAI-compatible, `https://api.opencode.ai/v1`), OpenRouter (fallback), Google Gemini (embedding)
3. Import `rag/chatbot.json` → aktifkan workflow
4. Salin production webhook URL → update `N8N_WEBHOOK_URL` di `.env` → `docker compose restart backend`

---

## Konfigurasi `.env`

```env
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=chatbot-postgres
DB_URL=postgresql://postgres:password@db:5432/chatbot-postgres

FRONTEND_URL=http://localhost
HOST=localhost
NODE_ENV=development

JWT_SECRET=secret
ADMIN_PWD=password_admin
INDEXER_SECRET=secret_indexer
N8N_SECRET=n8n_encryption_key

N8N_WEBHOOK_URL=http://n8n:5678/webhook/rag
INDEXER_URL=http://indexer:5000

GOOGLE_API_KEY=AIzxxxxxxxxxxxxxxxxxxxxxxxx
OPENCODE_API_KEY=oc-xxxxxxxxxxxxxxxxxxxxxxxxx
OPENROUTER_API_KEY=sk-or-xxxxxxxxxxxxxxxxx
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
REPORT_RECIPIENT=contohemail@gmail.com
QDRANT_COLLECTION=knowledge_base_epson
```
---

## Akses Aplikasi

| URL                                | Keterangan                          |
|------------------------------------|-------------------------------------|
| `http://localhost`                 | Halaman utama / login               |
| `http://localhost/chatbot`         | Antarmuka chatbot                   |
| `http://localhost/admin`           | Admin panel (butuh role ADMIN)      |
| `http://localhost/api/health`      | Health check backend                |
| `http://localhost:5678`            | n8n dashboard (akses lokal saja)    |
| `http://localhost:6333/dashboard`  | Qdrant dashboard (akses lokal saja) |

Login default: `admin` / `<ADMIN_PWD dari .env>`

---

## Tech Stack RAG

| Komponen        | Model / Library                                                          |
|-----------------|--------------------------------------------------------------------------|
| LLM utama       | `deepseek/deepseek-v4-flash` via OpenCode (OpenAI-compatible)            |
| LLM fallback    | `qwen/qwen3.5-flash-02-23` via OpenRouter                                |
| Embedding       | `models/gemini-embedding-2` (vektor dimensi 3072, Cosine similarity)     |
| Analisis gambar | `minimax/M3` via OpenCode → fallback `qwen/qwen3.5-flash-02-23` via OpenRouter |
| Chunking        | `RecursiveCharacterTextSplitter` (1000 chars, overlap 150)                |

---

## Perintah Berguna

```bash
docker compose ps                                            # status service
docker compose logs -f                                       # tail log
curl http://localhost:5000/stats                             # stats indexer
curl http://localhost:6333/collections/knowledge_base_epson  # cek Qdrant
docker exec -it helpdesk-backend npx prisma studio           # GUI database

# Reset koleksi Qdrant (WARNING: data terhapus)
curl -X DELETE http://localhost:6333/collections/knowledge_base_epson
curl -X PUT http://localhost:6333/collections/knowledge_base_epson \
  -H "Content-Type: application/json" \
  -d '{"vectors": {"size": 3072, "distance": "Cosine"}}'
```
---

## Troubleshooting

**Indexer gagal embed** — cek `docker logs helpdesk-indexer -f`; pastikan collection Qdrant sudah ada.

**n8n tidak bisa konek ke Qdrant/PostgreSQL** — gunakan hostname Docker (`qdrant`, `db`), bukan `localhost`.

**Error dimensi embedding** — `gemini-embedding-2` menghasilkan vektor **3072 dimensi**; jika ganti model embedding, hapus dan buat ulang collection Qdrant.

---