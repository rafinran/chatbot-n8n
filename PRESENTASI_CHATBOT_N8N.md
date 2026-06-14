# Epson Helpdesk AI - Dokumentasi Teknis Chatbot RAG
**Presentasi: Chatbot Berbasis Retrieval Augmented Generation (RAG) untuk Internal Helpdesk Epson**

---

## 📋 Daftar Isi
1. [Overview Sistem](#overview-sistem)
2. [Arsitektur & Komponen](#arsitektur--komponen)
3. [Tech Stack](#tech-stack)
4. [Fungsi Teknis Setiap Service](#fungsi-teknis-setiap-service)
5. [Alur Data & Workflow](#alur-data--workflow)
6. [Database Schema](#database-schema)
7. [API Endpoints Utama](#api-endpoints-utama)
8. [Konfigurasi & Deployment](#konfigurasi--deployment)

---

## 📊 Overview Sistem

**Epson Helpdesk AI** adalah chatbot internal yang menggunakan teknologi **Retrieval Augmented Generation (RAG)** untuk menjawab pertanyaan seputar troubleshooting printer dan tinta Epson. 

**Keunggulan RAG:**
- ✅ Jawaban berbasis knowledge base (bukan LLM general knowledge)
- ✅ Source terbukti & traceable
- ✅ Update real-time tanpa retrain model
- ✅ Akurat untuk domain spesifik (Epson troubleshooting)

---

## 🏗️ Arsitektur & Komponen

```
┌─────────────────────────────────────────────────────────┐
│            User Browser (Chatbot UI)                    │
└─────────────────────────┬───────────────────────────────┘
                          │ HTTPS
        ┌─────────────────▼───────────────────┐
        │   Nginx Reverse Proxy (Port 80/443) │
        │   - Rate Limiting                   │
        │   - SSL/TLS (Let's Encrypt)        │
        └───┬──────────────────────────────┬──┘
            │                              │
       ┌────▼─────────┐          ┌────────▼────────┐
       │  Frontend    │          │    Backend      │
       │  Next.js 14  │          │ Express + TS    │
       │ Port: 3000   │          │  Port: 8000     │
       └──────────────┘          └────────┬────────┘
                                          │
         ┌────────────────┬───────────────┼────────────────┐
         │                │               │                │
    ┌────▼──────┐  ┌─────▼─────┐  ┌─────▼──────┐   ┌────▼────┐
    │ PostgreSQL│  │    n8n    │  │  Indexer   │   │  Qdrant │
    │Port: 5432 │  │Port: 5678 │  │Port: 5000  │   │Port:6333│
    │ Auth/Logs │  │ RAG Flow  │  │ FastAPI    │   │Vectors  │
    └───────────┘  └───────────┘  └────────────┘   └─────────┘
```

---

## 🛠️ Tech Stack

| Layer | Teknologi | Fungsi |
|-------|-----------|--------|
| **Frontend** | Next.js 14 + Tailwind CSS + shadcn/ui | UI Chatbot, Admin Panel, Real-time Chat |
| **Backend** | Express.js + TypeScript + Prisma ORM | API Gateway, Auth JWT, Chat Logic, Document Mgmt |
| **Database** | PostgreSQL 16 | Users, Chats, Documents, Logs, Escalations |
| **Vector DB** | Qdrant | Semantic Search, Knowledge Base Embeddings |
| **RAG Flow** | n8n | Orchestration, LLM Integration, Vector Search |
| **Indexer** | FastAPI + Python | Text Extraction, Chunking, Embedding Generation |
| **Proxy** | Nginx + Let's Encrypt | HTTPS, Reverse Proxy, Rate Limit |
| **Container** | Docker Compose | Orchestration & Networking |

---

## 🔧 Fungsi Teknis Setiap Service

### 🎨 Frontend (Next.js 14)
**Port:** 3000 | **Framework:** React + Next.js 14

**Fungsi:**
- UI responsif untuk chat interaktif
- Admin panel untuk knowledge base management
- Authentication UI (login/register)
- Real-time message streaming
- Document upload interface

**Route Utama:**
- `/` - Landing page & login
- `/chatbot` - Main chat interface
- `/admin` - Dashboard admin (role-based)
- `/docs` - Knowledge base viewer

---

### ⚙️ Backend (Express + TypeScript)
**Port:** 8000 | **Framework:** Express.js + Prisma ORM

**Fungsi:**
- **Auth API** - JWT token management, role-based access control (RBAC)
- **Chat API** - Message handling, history, real-time updates
- **Document API** - Upload, validation, indexing trigger
- **Admin API** - User management, analytics, escalation handling
- **Health Check** - Service status monitoring

**Key Endpoints:**
- `POST /auth/login` - User authentication
- `POST /chat/message` - Send message to RAG
- `POST /documents/upload` - Upload knowledge base
- `GET /admin/analytics` - Chat analytics
- `GET /health` - Health status

---

### 🔍 Indexer (FastAPI + Python)
**Port:** 5000 | **Framework:** FastAPI + Python

**Fungsi:**
- **Text Extraction** - PDF, DOCX, TXT parsing
- **Chunking** - RecursiveCharacterTextSplitter (1000 chars, 150 overlap)
- **Embedding** - Generate vectors via Gemini Embedding API
- **Vector Storage** - Persist embeddings to Qdrant
- **Stats Endpoint** - Monitor indexing progress

**Algoritma Chunking:**
```
Input: Large document (misal: 10,000 chars)
↓
Split by '\n\n' (paragraph), '\n' (line), ' ' (word)
↓
Max chunk: 1000 chars, Overlap: 150 chars
↓
Chunk 1: chars 0-1000
Chunk 2: chars 850-1850 (150 overlap)
Chunk 3: chars 1700-2700
...
↓
Output: N chunks ready for embedding
```

---

### 🤖 n8n RAG Workflow
**Port:** 5678 | **Purpose:** Orchestrate RAG pipeline

**Workflow Steps:**
1. **Receive Trigger** - Webhook dari backend
2. **User Query** → `n8n.input` 
3. **Vector Search** - Query Qdrant dengan similarity threshold
4. **Retrieve Context** - Top K documents matching query
5. **Prompt Engineering** - Build system + user prompt
6. **LLM Call** - Google Gemini (primary) atau OpenRouter (fallback)
7. **Response Formatting** - Add source citations
8. **Webhook Response** - Return ke backend

**LLM Models:**
- 🟢 **Primary:** `models/gemini-3.1-flash-lite`
- 🟡 **Fallback:** `deepseek/deepseek-v4-flash` via OpenRouter

---

### 🔐 PostgreSQL Database
**Port:** 5432 | **Engine:** PostgreSQL 16

**Tabel Utama:**
```sql
-- Users & Auth
users (id, email, password_hash, role, created_at)
roles (id, name, permissions)

-- Chat Data
chat_sessions (id, user_id, created_at, updated_at)
chat_messages (id, session_id, user_id, message, response, n8n_request_id)

-- Knowledge Base
documents (id, title, file_path, status, indexed_at, created_by)
document_chunks (id, document_id, chunk_index, content, qdrant_point_id)

-- Admin & Logs
activity_logs (id, user_id, action, resource, timestamp)
escalations (id, chat_id, reason, assigned_to, status)
analytics (id, date, total_queries, avg_response_time, success_rate)
```

---

### 🗂️ Qdrant Vector Database
**Port:** 6333 | **Type:** Vector Search Engine

**Collection:** `knowledge_base_epson`

**Konfigurasi:**
- Vector Size: 3072 dimensi (Gemini Embedding)
- Distance Metric: Cosine Similarity
- Indexed: Hnsw (hierarchical navigable small world)

**Query Logic:**
```
User: "Kenapa printer saya tidak bisa print?"
↓
Embedding: [0.12, -0.34, 0.89, ..., 0.21] (3072 dims)
↓
Qdrant Search: similarity > 0.7
↓
Result: [
  { id: 1, score: 0.92, text: "Solusi troubleshooting print error..." },
  { id: 2, score: 0.85, text: "Pastikan driver terinstall..." }
]
```

---

## 🔄 Alur Data & Workflow

### 📝 Chat Request Flow
```
1. User mengetik pesan di Frontend
   ↓
2. Frontend → Backend POST /chat/message
   ├─ payload: { session_id, message, user_id }
   ↓
3. Backend validasi & simpan ke DB
   ├─ INSERT chat_messages (user_id, message, ...)
   ↓
4. Backend trigger n8n webhook
   ├─ POST N8N_WEBHOOK_URL dengan message
   ↓
5. n8n RAG Workflow
   ├─ Embed query: "Kenapa printer tidak print?"
   ├─ Search Qdrant: similarity("Printer troubleshooting")
   ├─ Retrieve top-3 documents
   ├─ Call LLM (Gemini) dengan context
   ├─ Generate response + citations
   ↓
6. n8n return response ke Backend
   ├─ response_text, sources, metadata
   ↓
7. Backend simpan response
   ├─ UPDATE chat_messages SET response = ..., n8n_request_id = ...
   ↓
8. Backend return ke Frontend
   ├─ { message_id, response, sources, created_at }
   ↓
9. Frontend render response + source links
```

### 📤 Document Indexing Flow
```
1. Admin upload file PDF/DOCX
   ↓
2. Frontend → Backend POST /documents/upload
   ↓
3. Backend
   ├─ Validate file (size, type)
   ├─ Save to storage
   ├─ INSERT documents table
   ├─ Trigger indexer API
   ↓
4. Indexer FastAPI
   ├─ Extract text (PyPDF2, python-docx)
   ├─ Chunk text (1000 chars, 150 overlap)
   ├─ Batch embed via Gemini API (100 chunks/batch)
   ├─ POST vectors to Qdrant
   ↓
5. Qdrant stores vectors
   ├─ Point ID = auto-increment
   ├─ Metadata = { doc_id, chunk_idx, source_file }
   ↓
6. Indexer → Backend notify success
   ├─ UPDATE documents SET status='indexed'
```

---

## 💾 Database Schema (Key Tables)

```sql
-- 👥 Authentication & Users
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role_id INT REFERENCES roles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 💬 Chat History
CREATE TABLE chat_sessions (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  session_id INT REFERENCES chat_sessions(id),
  user_id INT REFERENCES users(id),
  user_message TEXT NOT NULL,
  ai_response TEXT,
  n8n_request_id VARCHAR(255),
  qdrant_score FLOAT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 📄 Document Management
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  file_path VARCHAR(500),
  file_size INT,
  status VARCHAR(50), -- 'uploaded', 'indexing', 'indexed', 'error'
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  indexed_at TIMESTAMP
);

-- 📊 Vector Reference
CREATE TABLE document_chunks (
  id SERIAL PRIMARY KEY,
  document_id INT REFERENCES documents(id),
  chunk_index INT,
  content TEXT,
  qdrant_point_id BIGINT, -- link ke Qdrant vector ID
  created_at TIMESTAMP DEFAULT NOW()
);

-- 📈 Analytics
CREATE TABLE analytics (
  id SERIAL PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE,
  total_messages INT DEFAULT 0,
  avg_response_time_ms FLOAT,
  user_satisfaction FLOAT,
  documents_indexed INT DEFAULT 0
);
```

---

## 🌐 API Endpoints Utama

### Authentication
```
POST /auth/login
Body: { email, password }
Response: { access_token, user_id, role }

POST /auth/logout
Response: { message: "Logged out" }

POST /auth/refresh
Response: { access_token }
```

### Chat
```
POST /chat/message
Body: { session_id, message }
Response: { 
  message_id, 
  ai_response, 
  sources: [{ title, score, chunk }],
  response_time_ms
}

GET /chat/history/:session_id
Response: [ { user_message, ai_response, created_at }, ... ]
```

### Documents (Admin)
```
POST /documents/upload
Body: FormData { file, document_type }
Response: { document_id, status: "indexing" }

GET /documents
Response: [ { id, title, status, indexed_at }, ... ]

DELETE /documents/:id
Response: { message: "Deleted" }
```

### Admin Analytics
```
GET /admin/analytics?date_from=2024-01-01&date_to=2024-01-31
Response: {
  total_queries: 1234,
  avg_response_time: 2345,
  success_rate: 0.95,
  top_questions: [...]
}

GET /admin/users
Response: [ { id, email, role, created_at }, ... ]
```

### Health & Monitoring
```
GET /health
Response: { status: "ok", timestamp, service_status: { ... } }

GET /indexer/stats
Response: { total_documents: 45, total_chunks: 1200, last_indexed: "..." }
```

---

## ⚙️ Konfigurasi & Deployment

### Environment Variables (.env)
```env
# Database
DB_USERNAME=postgres
DB_PASSWORD=<secure-password>
DB_NAME=chatbot-postgres
DB_URL=postgresql://postgres:password@db:5432/chatbot-postgres

# Application
FRONTEND_URL=https://example.com
NODE_ENV=production
HOST=0.0.0.0

# Security
JWT_SECRET=<very-long-random-string>
ADMIN_PWD=<admin-password>
INDEXER_SECRET=<indexer-api-secret>
N8N_SECRET=<n8n-encryption-key>

# Service URLs
N8N_WEBHOOK_URL=http://n8n:5678/webhook/rag
INDEXER_URL=http://indexer:5000

# LLM APIs (REQUIRED)
GOOGLE_API_KEY=AIza...
OPENROUTER_API_KEY=sk-or-...

# Optional: Email Reports
RESEND_API_KEY=re_...
REPORT_RECIPIENT=admin@example.com

# Qdrant
QDRANT_URL=http://qdrant:6333
QDRANT_COLLECTION=knowledge_base_epson
```

### Docker Compose Setup
```bash
# 1. Clone & config
git clone https://github.com/rafinran/chatbot-n8n
cd chatbot-n8n
cp .env.example .env  # Edit with API keys

# 2. Build & deploy
docker compose up --build -d

# 3. Initialize database
docker exec helpdesk-backend npx prisma db push
docker exec helpdesk-backend npx prisma db seed

# 4. Import n8n workflow
# - Go to http://localhost:5678
# - Create credentials (Qdrant, PostgreSQL, Google Gemini, OpenRouter)
# - Import rag/chatbot.json
# - Activate & get webhook URL
# - Update N8N_WEBHOOK_URL in .env
# - docker compose restart backend
```

### Monitoring & Troubleshooting
```bash
# Check services status
docker compose ps

# View logs
docker compose logs -f backend
docker compose logs -f indexer
docker compose logs -f n8n

# Database inspection
docker exec -it helpdesk-backend npx prisma studio

# Vector DB status
curl http://localhost:6333/collections/knowledge_base_epson

# Reset Qdrant (⚠️ WARNING: DESTRUCTIVE)
curl -X DELETE http://localhost:6333/collections/knowledge_base_epson
```

---

## 🎯 Key Features

✅ **RAG-Based Answers** - Akurat, traceable, up-to-date
✅ **Multi-LLM Fallback** - Gemini primary, OpenRouter backup
✅ **Role-Based Access** - Admin, User, Support roles
✅ **Document Management** - Upload, auto-index, versioning
✅ **Chat History** - Persistent sessions & logs
✅ **Analytics Dashboard** - Performance metrics
✅ **Escalation System** - Route complex issues to humans
✅ **HTTPS/SSL** - Let's Encrypt integration
✅ **Rate Limiting** - Nginx protection
✅ **Docker Native** - One-command deployment

---

**Last Updated:** June 2024 | **Version:** 1.0
