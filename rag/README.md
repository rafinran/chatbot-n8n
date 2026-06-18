# n8n RAG Workflows — Epson Helpdesk AI

Berisi workflow n8n yang mengatur Retrieval-Augmented Generation (RAG) pipeline untuk chatbot helpdesk Epson.

```
rag/
├── Chatbot Streaming + Manual RAG + Score Filter.json  # WORKFLOW UTAMA (streaming)
├── Chatbot.json                                          # WORKFLOW LAMA (sync, deprecated)
├── ollama/                                               # Model data (jika pakai Ollama)
├── qdrant_storage/                                       # Persistent Qdrant vector DB
└── n8n_data/                                             # n8n internal data
```

## Workflow Utama: `Chatbot Streaming + Manual RAG + Score Filter.json`

Workflow streaming dengan RAG pipeline manual (tanpa Edit Fields node — raw AI Agent output):

### Alur Lengkap

```
[Webhook] → [Embed Question] → [Qdrant Vector Search] → [Cohere Rerank]
    → [Score Filter (>0.3)] → [Prompt Template] → [AI Agent (MiniMax M2.1)]
    → [Streaming Response]
```

### Step-by-step

1. **Webhook** (`POST`)
   - Menerima request dari backend: `{ question, user_id, user_email }`
   - Response mode: **streaming** (tanpa wait for response)
   - Output: raw streaming chunks ke backend

2. **Embed Question**
   - Mengubah pertanyaan user menjadi vector embedding (Google Gemini embedding API)
   - Input: `{{ $json.question }}`
   - Output: vector array

3. **Qdrant Vector Search**
   - Mencari top-10 dokumen paling relevan dari Qdrant collection
   - Input vector: hasil step 2
   - Output: matched chunks with score

4. **Cohere Rerank**
   - Re-rank hasil Qdrant untuk meningkatkan akurasi
   - Model: Cohere rerank (default)
   - Output: re-ranked chunks

5. **Score Filter**
   - Filter: hanya chunks dengan score > 0.6
   - Menghilangkan noise/dokumen tidak relevan

6. **Prompt Template**
   - Template: `Kamu adalah asisten helpdesk Epson. Jawab pertanyaan berdasarkan konteks berikut: [context]`
   - Input: filtered chunks dari re-rank
   - Output: formatted prompt + context

7. **AI Agent (MiniMax M2.1)**
   - Model: MiniMax M2.1 via OpenCode/OpenAI-compatible
   - Input: prompt + context
   - Output: jawaban natural language
   - Raw output (tanpa Edit Fields / post-processing)

8. **Streaming Response**
   - n8n mengirim jawaban token-by-token via SSE
   - Backend membaca streaming chunks, parse, forward ke frontend

### Kenapa Manual RAG?

Tidak menggunakan n8n AI Agent built-in RAG karena:

- Kontrol penuh atas retrieval pipeline (custom embedding, custom rerank)
- Score filter menghilangkan dokumen tidak relevan sebelum masuk prompt
- Lebih mudah debugging (setiap node independen)
- Integrasi dengan Qdrant yang sudah ada

## Workflow Lama: `Chatbot.json`

Workflow sync (non-streaming):

```
[Webhook] → [Edit Fields (format)] → [HTTP Request (Qdrant)]
    → [Edit Fields (parse)] → [AI Agent] → [Response]
```

**Keterbatasan:**

- Response sync (tunggu selesai baru dikirim)
- Qdrant query manual via HTTP Request (bukan native Qdrant node)
- Tidak ada rerank atau score filter

## Vector Database: Qdrant

- **Collection:** `epson_faq` (default, dari env `COLLECTION_NAME`)
- **Vector size:** 3072 (Gemini embedding-2)
- **Distance:** Cosine
- **Storage:** `rag/qdrant_storage/` (persistent volume di docker-compose)

## Konfigurasi n8n

n8n dijalankan via subdomain `n8n.chatson.my.id` (proxy oleh nginx). Bukan di docker-compose utama — di-deploy terpisah.

**Environment:**

- `N8N_PORT` → port internal
- Database PostgreSQL internal
- Qdrant URL: `http://<qdrant-host>:6333`
- Google API key untuk embedding
- OpenCode / OpenRouter API key untuk AI Agent

## Catatan Penting

1. **Streaming vs Sync:** Workflow streaming WAJIB menggunakan `responseMode: "streaming"` di Webhook node. Kalau tidak, backend akan timeout menunggu response.
2. **Embed Question** node masih pakai Google Gemini API langsung — jika perlu diganti ke OpenRouter, harus manual di UI n8n.
3. **Cohere Rerank** perlu API key Cohere yang valid.
4. **Score filter 0.3** — bisa disesuaikan: lebih rendah → lebih banyak konteks (tapi lebih noise), lebih tinggi → lebih selektif (tapi mungkin kurang konteks).
5. **MiniMax M2.1** dipilih karena vision-capable dan murah. Alternatif: DeepSeek V4, Qwen, Gemini.
