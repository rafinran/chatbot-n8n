# Epson Helpdesk AI

Chatbot helpdesk internal berbasis RAG untuk troubleshooting printer dan tinta Epson. User bisa bertanya via teks atau foto, jawaban diambil dari knowledge base yang diindeks ke Qdrant.

---

## Arsitektur

```
Browser → Nginx (:80)
              ├── /*       → Frontend  (Next.js 14)
              └── /api/*   → Backend   (Express + TypeScript :8000)
                    │
                    ├── Auth (JWT httpOnly cookie)
                    ├── Chat → n8n webhook (RAG workflow)
                    └── Admin → Python Indexer (:5000) → Qdrant
```

| Service | Teknologi | Fungsi |
|---|---|---|
| `nginx` | Nginx | Reverse proxy, rate limiting |
| `frontend` | Next.js 14 + Tailwind + shadcn/ui | UI chatbot & admin panel |
| `backend` | Express + TypeScript + Prisma | API gateway, auth, chat, document management |
| `db` | PostgreSQL 16 | User, document, activity logs |
| `indexer` | FastAPI + Python | Ekstraksi teks, chunking, embedding → Qdrant |
| `qdrant` | Qdrant | Vector database (knowledge_base_epson) |
| `n8n` | n8n | RAG orchestration workflow |
| `ollama` | Ollama (gemma3:4b) | Fallback image analysis |

---

## Prasyarat

- Docker & Docker Compose
- Google Gemini API Key ([aistudio.google.com](https://aistudio.google.com/app/apikey))
- n8n instance (self-hosted via Docker, sudah include di compose)

---

## Instalasi

### 1. Clone & setup env

```bash
cp .env.example .env
# Isi semua variabel yang required
```

### 2. Jalankan semua service

```bash
docker compose up --build -d
```

### 3. Setup database

```bash
docker exec helpdesk-backend npx prisma db push
docker exec helpdesk-backend npx prisma db seed
```

### 4. Import workflow n8n

1. Buka `http://<host>:5678` (SSH tunnel jika port tertutup)
2. Buat credential untuk Qdrant, PostgreSQL, Gemini
3. Import workflow dari `rag/n8n-workflow.json`
4. Set webhook URL di `.env` (`N8N_WEBHOOK_URL`)

### 5. Akses

| URL | Akses |
|---|---|
| `http://localhost` | Chatbot |
| `http://localhost/api/admin` | Admin panel (dashboard) |
| `http://localhost/api/health` | Health check |

Login default: `admin` / (password dari `ADMIN_PASSWORD` di `.env`)

---

## Fitur

- **Chat dengan AI** — teks + analisis gambar (Gemini 2.5 Flash, fallback Ollama)
- **Knowledge Base** — upload PDF, DOCX, TXT, MD, CSV, XLSX → otomatis diindeks
- **RAG Pipeline** — via n8n (vector search Qdrant + Gemini generate)
- **Admin Panel** — manage dokumen, re-index gagal, manage user
- **Security** — rate limiting Nginx, JWT httpOnly cookie, port internal tertutup

---

## Perintah Penting

```bash
# Logs
docker logs helpdesk-backend -f
docker logs helpdesk-indexer -f

# Cek indexer
curl http://localhost:5000/health
curl http://localhost:5000/stats

# Cek Qdrant
curl http://localhost:6333/collections/knowledge_base_epson

# Rebuild service
docker compose build --no-cache <service> && docker compose up -d <service>

# Reset collection Qdrant
curl -X DELETE http://localhost:6333/collections/knowledge_base_epson
```

---

## Tech Stack Detail

- **LLM**: `models/gemini-2.0-flash-lite` (via n8n AI Agent)
- **Embedding**: `models/gemini-embedding-2` (1024 dim, Cosine)
- **Image Analysis**: `gemini-2.5-flash` → fallback `gemma3:4b` via Ollama
- **Chunking**: RecursiveCharacterTextSplitter (800 chars, overlap 120)
- **Vector DB**: Qdrant collection `knowledge_base_epson`
