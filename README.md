# Epson Helpdesk AI

Sistem chatbot helpdesk berbasis AI untuk mendukung karyawan dalam menyelesaikan masalah teknis seputar printer Epson ET-2400. Sistem ini menggunakan pendekatan **Retrieval-Augmented Generation (RAG)** untuk menjawab pertanyaan berdasarkan knowledge base internal.

---

## Arsitektur

| Service | Teknologi | Fungsi |
|---|---|---|
| `rag` | Python, FastAPI | RAG pipeline, embedding, retrieval |
| `backend` | Node.js, Express | API gateway, auth, activity log |
| `frontend` | React, Vite, Nginx | Antarmuka chatbot |
| `db` | PostgreSQL 16 | Penyimpanan user dan activity log |

---

## Prasyarat
- Docker: Pastikan docker sudah berjalan. Download melalui [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Google Gemini API Key: Dapatkan API Key gemini melalui [aistudio.google.com](https://aistudio.google.com/app/apikey)

---

## Instalasi & Menjalankan

### 1. Clone repository

```bash
git clone https://github.com/rafinran/capstone-chatbot/
cd capstone-chatbot
```

### 2. Buat file `.env`

Salin template dan isi nilai yang diperlukan:

```bash
cp .env.example .env
```

Isi file `.env`:

```dotenv
DB_USERNAME=
DB_PASSWORD=
DB_NAME=
DB_HOST
DB_URL=postgresql://admin:password@db:5432/chatbot

JWT_SECRET= secret
FRONTEND_URL=http://localhost:5173
NODE_ENV=development

GOOGLE_API_KEY=AIzaxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. Tambahkan dokumen knowledge base

Taruh file FAQ dalam format `.md` ke folder `rag/knowledge_base/`. Dokumen yang sudah tersedia:

```
rag/knowledge_base/
├── faq_print_quality.md
├── faq_ink_maintenance.md
├── faq_wireless.md
└── faq_paper_scanning.md
```

### 4. Jalankan semua service

```bash
docker compose up --build
```

Proses pertama kali akan membutuhkan waktu lebih lama karena:
- Download base image Docker
- Install dependencies Python dan Node.js
- Download embedding model `all-MiniLM-L6-v2` (~90MB)
- Indexing dokumen ke ChromaDB

### 5. Akses aplikasi

Buka browser dan akses:

```
http://localhost:5173
```

Login menggunakan akun default yang dibuat otomatis saat pertama jalan:

```
Username : admin
Password : admin123
```

---

## Menambah Dokumen FAQ

1. Buat file `.md` baru di folder `rag/knowledge_base/`
2. Format yang disarankan:

```markdown
# Judul Kategori

## Pertanyaan?
Jawaban lengkap di sini.

---

## Pertanyaan lain?
Jawaban lengkap di sini.
```

3. Jalankan indexing ulang:

```bash
docker compose exec rag-service python main.py --index
```

---

