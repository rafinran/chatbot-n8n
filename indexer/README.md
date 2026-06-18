# Indexer — Epson Helpdesk AI

Python microservice untuk indexing dokumen ke Qdrant vector database. Memonitor folder `docs-inbox/`, membaca file, memecah jadi chunks, membuat embeddings via OpenRouter, dan menyimpan ke Qdrant.

```
indexer/
├── main.py              # Entry point: FastAPI server + folder watcher
├── requirements.txt     # Python dependencies
└── Dockerfile           # Python 3.11 slim
```

## Cara Kerja

```
[Admin upload doc via backend] → [doc_{id}/ di docs-inbox] → [Indexer detect]
    → [Extract text] → [Chunk] → [Embed via OpenRouter] → [Upsert ke Qdrant]
    → [Update status backend: "indexed"]
```

### Step-by-step dalam kode:

1. **Folder Watcher** (`start_watcher()` → `InboxHandler`)
   - Menggunakan `watchdog` untuk monitor folder `/docs-inbox`
   - Saat folder baru `doc_{id}` muncul → ambil `doc_id` dari nama folder
   - Cari file di dalam folder + `meta.txt` (berisi original filename)
   - Panggil `index_document(doc_id, file_path, original_name)`

2. **Extract Text** (`extract_text()`)
   - **PDF:** `pypdf.PdfReader` — extract per page
   - **DOCX:** `python-docx` — extract per paragraph
   - **TXT/MD:** `file.read_text()` — baca langsung
   - **CSV:** `file.read_text()` — baca langsung
   - **XLSX/XLS:** `pandas.ExcelFile` → parse per sheet → format sebagai Q&A blocks (Topik, Pertanyaan, Jawaban)
   - **Lainnya:** raise `ValueError("Format tidak didukung")`

3. **Chunking** (`chunk_text()`)
   - **XLSX:** chunks per Q&A block (tiap baris jadi 1 chunk). Kalau jawaban panjang, dipotong dengan Q-prefix injection ("Topik: ...\nPertanyaan: ...\n[lanjutan]").
   - **Non-XLSX:** `RecursiveCharacterTextSplitter` dari LangChain:
     - `chunk_size = 1000`
     - `chunk_overlap = 150`
     - Separators: `["\n\n", "\n", ". ", "? ", "! ", " ", ""]`

4. **Embedding** (`embed_chunks()`)
   - Call `POST https://openrouter.ai/api/v1/embeddings`
   - Model: `google/gemini-embedding-2` (3072 dimensi)
   - Exponential backoff retry (max 5 attempts) untuk 429 rate limits
   - Request per chunk (bisa di-batch)

5. **Upsert ke Qdrant** (`index_document()`)
   - Generate `point_id` dari `hashlib.md5(f"{doc_id}_{i}".encode())`
   - Payload per point: `content`, `metadata.source`, `metadata.blobType`, `metadata.doc_id`, `metadata.original_name`, `metadata.line`, `metadata.loc`
   - Hapus vectors lama milik doc_id yang sama (`_delete_doc_vectors()`)
   - Upsert batch (batch size: 100)

6. **Update Status** (`_update_status()`)
   - `PATCH /api/admin/documents/{doc_id}/status` ke backend
   - Header: `x-indexer-secret`
   - Body: `{ status: "indexed" }` atau `{ status: "failed", errorMessage: "..." }`

## API Endpoints (FastAPI)

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/health` | Health check — return `{ status, collection, model }` |
| DELETE | `/delete/{doc_id}` | Hapus vectors dokumen dari Qdrant |
| GET | `/stats` | Statistik collection: `vectors_count`, `points_count` |

## Configuration (Environment Variables)

| Variable | Required | Deskripsi |
|----------|----------|-----------|
| `QDRANT_URL` | ✅ | Qdrant server URL |
| `COLLECTION_NAME` | ✅ | Nama collection di Qdrant |
| `BACKEND_URL` | ✅ | Backend API URL (untuk update status) |
| `INDEXER_SECRET` | ✅ | Secret header untuk callback backend |
| `OPENROUTER_API_KEY` | ✅ | OpenRouter API key untuk embeddings |
| `DOCS_INBOX` | ❌ | Path folder monitor (default: `/docs-inbox`) |

## Dependencies

- `fastapi` + `uvicorn` — HTTP server
- `watchdog` — file system event monitoring
- `qdrant-client` — Qdrant vector DB client
- `pypdf` — PDF text extraction
- `python-docx` — DOCX text extraction
- `pandas` + `openpyxl` — XLSX parsing
- `httpx` — HTTP client (OpenRouter API calls)
- `langchain-text-splitters` — RecursiveCharacterTextSplitter
- `python-multipart` — multipart form data support

## Chunking Strategy

| Format | Chunk Size | Overlap | Strategy |
|--------|-----------|---------|----------|
| XLSX (Q&A) | Per baris | N/A | 1 baris = 1 chunk. Jawaban panjang dipotong dengan Q-prefix injection |
| PDF/DOCX/TXT/MD/CSV | 1000 chars | 150 chars | RecursiveCharacterTextSplitter dengan separator hierarkis |

### Kenapa Chunk Size 1000 + Overlap 150?
- **Chunk 1000:** Pas untuk FAQ entry pendek (1-3 kalimat). Tidak terlalu besar hingga mencampur topik, tidak terlalu kecil hingga konteks hilang. Sweet spot RAG (langchain default).
- **Overlap 150 (15%):** Mencegah konteks terpotong di sambungan chunk. Tidak boros (overlap >20% memperbesar indeks).
- **Model embedding:** `gemini-embedding-2` (3072 dim) optimal untuk teks 500-1000 karakter.
