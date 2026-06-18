import os
import time
import logging
import asyncio
import hashlib
from pathlib import Path
from typing import Optional

import httpx
import uvicorn
from fastapi import FastAPI
from contextlib import asynccontextmanager
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
from langchain_text_splitters import RecursiveCharacterTextSplitter

# ── Config ────────────────────────────────────────────────────────────────────
QDRANT_URL         = os.getenv("QDRANT_URL")
COLLECTION_NAME    = os.getenv("COLLECTION_NAME")
BACKEND_URL        = os.getenv("BACKEND_URL")
INDEXER_SECRET     = os.getenv("INDEXER_SECRET")
DOCS_INBOX         = Path(os.getenv("DOCS_INBOX", "/docs-inbox"))
OPENROUTER_API_KEY  = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE    = "https://openrouter.ai/api/v1"
EMBEDDING_MODEL    = "google/gemini-embedding-2"
VECTOR_SIZE        = 3072
CHUNK_SIZE         = 1000
CHUNK_OVERLAP      = 150

BLOB_TYPE_MAP = {
    ".pdf":  "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt":  "text/plain",
    ".md":   "text/markdown",
    ".csv":  "text/csv",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls":  "application/vnd.ms-excel",
}

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

_qdrant: Optional[QdrantClient] = None


def get_qdrant() -> QdrantClient:
    global _qdrant
    if _qdrant is None:
        _qdrant = QdrantClient(url=QDRANT_URL)
        _ensure_collection(_qdrant)
    return _qdrant


def _ensure_collection(client: QdrantClient):
    existing = [c.name for c in client.get_collections().collections]
    if COLLECTION_NAME not in existing:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )
        log.info("Collection '%s' dibuat.", COLLECTION_NAME)


def embed_chunks(chunks: list[str]) -> list[list[float]]:
    if not OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY tidak di-set.")

    all_embeddings: list[list[float]] = []
    max_retries = 5

    for chunk in chunks:
        for attempt in range(max_retries):
            try:
                resp = httpx.post(
                    f"{OPENROUTER_BASE}/embeddings",
                    headers={
                        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={"model": EMBEDDING_MODEL, "input": chunk},
                    timeout=30,
                )
                if resp.status_code == 429:
                    wait = (2 ** attempt) * 1.5
                    log.warning("Rate limit 429, retry %d/%d in %.1fs", attempt + 1, max_retries, wait)
                    time.sleep(wait)
                    continue
                resp.raise_for_status()
                data = resp.json()
                all_embeddings.append(data["data"][0]["embedding"])
                break
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    wait = (2 ** attempt) * 1.5
                    log.warning("Rate limit 429, retry %d/%d in %.1fs", attempt + 1, max_retries, wait)
                    time.sleep(wait)
                    continue
                raise
        else:
            raise RuntimeError(f"Gagal embed chunk setelah {max_retries} retry")

    return all_embeddings


def _delete_doc_vectors(client: QdrantClient, doc_id: int):
    client.delete(
        collection_name=COLLECTION_NAME,
        points_selector=Filter(
            must=[FieldCondition(key="metadata.doc_id", match=MatchValue(value=doc_id))]
        ),
    )


# ── Text extractors ───────────────────────────────────────────────────────────

def extract_text(file_path: Path) -> str:
    """
    Untuk non-xlsx: ekstrak teks mentah.
    Untuk xlsx: delegasi ke _format_xlsx_qa_blocks() yang return teks terformat.
    """
    suffix = file_path.suffix.lower()
    log.info("Ekstrak teks dari: %s (tipe: %s)", file_path.name, suffix)

    if suffix == ".pdf":
        from pypdf import PdfReader
        reader = PdfReader(str(file_path))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)

    elif suffix == ".docx":
        from docx import Document
        doc = Document(str(file_path))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())

    elif suffix in (".txt", ".md"):
        return file_path.read_text(encoding="utf-8", errors="replace")

    elif suffix == ".csv":
        return file_path.read_text(encoding="utf-8", errors="replace")

    elif suffix in (".xlsx", ".xls"):
        # Untuk xlsx, kembalikan sentinel — chunking ditangani khusus di chunk_text()
        # supaya Q&A prefix-injection bisa berjalan per-block
        return _XLSX_SENTINEL

    else:
        raise ValueError(f"Format tidak didukung: {suffix}")


# Sentinel string supaya chunk_text() tahu ini xlsx yang perlu treatment khusus
_XLSX_SENTINEL = "__XLSX_QA_BLOCKS__"
_XLSX_FILE_PATH: Optional[Path] = None  # disimpan sementara untuk dipakai chunk_text


def _format_xlsx_qa_blocks(file_path: Path) -> list[str]:
    """
    Baca xlsx per-sheet, format tiap baris sebagai blok Q&A:

        Topik: <nama sheet>
        Pertanyaan: <isi kolom Pertanyaan/Question>
        Jawaban: <isi kolom Jawaban/Answer>

    Nama sheet dipakai sebagai topik — tidak perlu kolom Topik terpisah.
    Return: list of block strings (belum di-chunk).
    """
    import pandas as pd

    xl = pd.ExcelFile(file_path)
    blocks: list[str] = []

    for sheet_name in xl.sheet_names:
        df = xl.parse(sheet_name)
        df = df.dropna(how="all").dropna(axis=1, how="all")
        if df.empty:
            continue

        df.columns = [str(c).strip() for c in df.columns]

        # Cari kolom pertanyaan dan jawaban secara fleksibel
        q_col = next(
            (c for c in df.columns if any(k in c.lower() for k in ("pertanyaan", "question", "q"))),
            df.columns[0],
        )
        a_col = next(
            (c for c in df.columns if any(k in c.lower() for k in ("jawaban", "answer", "jawab", "solusi", "solution"))),
            df.columns[1] if len(df.columns) > 1 else df.columns[0],
        )

        topic = sheet_name.strip()

        for _, row in df.iterrows():
            q = str(row[q_col]).strip() if pd.notna(row[q_col]) else ""
            a = str(row[a_col]).strip() if pd.notna(row[a_col]) else ""
            if not q and not a:
                continue
            block = f"Topik: {topic}\nPertanyaan: {q}\nJawaban: {a}"
            blocks.append(block)

    log.info("xlsx '%s': %d Q&A blocks dari %d sheet", file_path.name, len(blocks), len(xl.sheet_names))
    return blocks


# ── Chunking ──────────────────────────────────────────────────────────────────

def _char_pos_to_lines(text: str, char_pos: int) -> int:
    return text[:char_pos].count("\n") + 1


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[dict]:
    """
    Untuk xlsx (sentinel): chunk per Q&A block dengan Q-prefix injection pada
    chunk lanjutan supaya konteks pertanyaan tidak hilang saat jawaban panjang.

    Untuk format lain: RecursiveCharacterTextSplitter standar.
    """
    if text == _XLSX_SENTINEL and _XLSX_FILE_PATH is not None:
        return _chunk_xlsx_qa(_XLSX_FILE_PATH, size, overlap)

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=size,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", ". ", "? ", "! ", " ", ""],
        length_function=len,
    )
    chunk_strings = splitter.split_text(text)
    results: list[dict] = []
    for chunk in chunk_strings:
        start = text.find(chunk)
        end = start + len(chunk) if start != -1 else -1
        results.append({
            "content": chunk,
            "loc": {
                "lines": {
                    "from": _char_pos_to_lines(text, start) if start != -1 else 0,
                    "to":   _char_pos_to_lines(text, end)   if end   != -1 else 0,
                }
            },
        })
    return results


def _chunk_xlsx_qa(file_path: Path, size: int, overlap: int) -> list[dict]:
    """
    Chunk Q&A blocks dari xlsx dengan aturan:
    1. Blok yang cukup pendek (≤ size) → 1 chunk, tidak disambung ke baris lain.
    2. Blok panjang → dipotong pakai splitter, tapi chunk ke-2, ke-3, dst.
       mendapat prefix "Topik + Pertanyaan + [lanjutan]" supaya konteks terjaga.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=size,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", ". ", "? ", "! ", " ", ""],
        length_function=len,
    )

    qa_blocks = _format_xlsx_qa_blocks(file_path)
    results: list[dict] = []
    line_cursor = 1  # estimasi nomor baris untuk metadata loc

    for block in qa_blocks:
        block_lines = block.count("\n") + 1
        from_line = line_cursor
        line_cursor += block_lines + 1  # +1 untuk separator antar block

        if len(block) <= size:
            # Pendek: langsung jadi 1 chunk, tidak ada risiko merge ke block berikutnya
            results.append({
                "content": block,
                "loc": {"lines": {"from": from_line, "to": from_line + block_lines - 1}},
            })
        else:
            # Panjang: potong, inject prefix ke chunk lanjutan
            lines = block.split("\n")
            prefix_lines = [l for l in lines if l.startswith("Topik:") or l.startswith("Pertanyaan:")]
            prefix = "\n".join(prefix_lines) + "\n"

            sub_chunks = splitter.split_text(block)
            for i, chunk in enumerate(sub_chunks):
                content = chunk if i == 0 else (prefix + "[lanjutan]\n" + chunk)
                sub_line_from = from_line + (i * (block_lines // max(len(sub_chunks), 1)))
                results.append({
                    "content": content,
                    "loc": {"lines": {"from": sub_line_from, "to": sub_line_from + content.count("\n")}},
                })

    log.info("xlsx chunking: %d Q&A blocks → %d chunks", len(qa_blocks), len(results))
    return results


# ── Indexer core ──────────────────────────────────────────────────────────────

async def index_document(doc_id: int, file_path: Path, original_name: str):
    """
    original_name: nama file asli yang di-pass dari backend (bukan nama file di disk),
    digunakan untuk metadata Qdrant supaya mudah diidentifikasi.
    """
    global _XLSX_FILE_PATH

    log.info("[doc_%d] Mulai indexing: %s", doc_id, original_name)
    try:
        # Untuk xlsx, simpan path dulu supaya chunk_text() bisa akses
        if file_path.suffix.lower() in (".xlsx", ".xls"):
            _XLSX_FILE_PATH = file_path

        text = extract_text(file_path)
        if not text.strip():
            raise ValueError("Tidak ada teks yang bisa diekstrak.")

        chunks = chunk_text(text)
        log.info("[doc_%d] %d chunks", doc_id, len(chunks))

        suffix = file_path.suffix.lower()
        blob_type = BLOB_TYPE_MAP.get(suffix, "application/octet-stream")

        chunk_contents = [c["content"] for c in chunks]

        BATCH = 100
        all_vectors: list[list[float]] = []
        for i in range(0, len(chunk_contents), BATCH):
            batch = chunk_contents[i : i + BATCH]
            all_vectors.extend(embed_chunks(batch))
            log.info("[doc_%d] Embedded %d/%d chunks", doc_id, min(i + BATCH, len(chunks)), len(chunks))

        qdrant = get_qdrant()
        points = []
        for i, (chunk, vector) in enumerate(zip(chunks, all_vectors)):
            point_id = int(hashlib.md5(f"{doc_id}_{i}".encode()).hexdigest()[:8], 16)
            points.append(PointStruct(
                id=point_id,
                vector=vector,
                payload={
                    "content": chunk["content"],
                    "metadata": {
                        "source":        "blob",
                        "blobType":      blob_type,
                        "doc_id":        doc_id,
                        # Pakai original_name dari backend, bukan nama file di disk
                        "original_name": original_name,
                        "line":          chunk["loc"]["lines"]["from"],
                        "loc":           chunk["loc"],
                    },
                },
            ))

        _delete_doc_vectors(qdrant, doc_id)
        qdrant.upsert(collection_name=COLLECTION_NAME, points=points)
        log.info("[doc_%d] ✅ %d chunks berhasil diindeks.", doc_id, len(points))

        await _update_status(doc_id, "indexed")

    except Exception as e:
        log.error("[doc_%d] ❌ Gagal: %s", doc_id, str(e))
        await _update_status(doc_id, "failed", str(e))
    finally:
        _XLSX_FILE_PATH = None
        try:
            file_path.unlink(missing_ok=True)
            file_path.parent.rmdir()
        except Exception:
            pass


async def _update_status(doc_id: int, status: str, error: str = None):
    payload = {"status": status}
    if error is not None:
        payload["errorMessage"] = error

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.patch(
                f"{BACKEND_URL}/api/admin/documents/{doc_id}/status",
                json=payload,
                headers={"x-indexer-secret": INDEXER_SECRET},
                timeout=10,
            )
            if resp.status_code != 200:
                log.warning("Update status doc_%d: HTTP %d — cek INDEXER_SECRET di .env", doc_id, resp.status_code)
    except Exception as e:
        log.warning("Gagal update status doc_%d: %s", doc_id, str(e))


# ── Folder watcher ────────────────────────────────────────────────────────────

class InboxHandler(FileSystemEventHandler):
    def __init__(self, loop: asyncio.AbstractEventLoop):
        self.loop = loop
        self._seen: set[str] = set()

    def on_created(self, event):
        if event.is_directory:
            self._handle_doc_dir(Path(event.src_path))

    def _handle_doc_dir(self, dir_path: Path):
        name = dir_path.name
        if not name.startswith("doc_") or name in self._seen:
            return
        self._seen.add(name)

        try:
            doc_id = int(name.split("_")[1])
        except ValueError:
            return

        time.sleep(0.5)
        files = list(dir_path.iterdir())
        if not files:
            return

        # Ambil original_name dari file metadata jika ada, fallback ke nama file
        meta_file = dir_path / "meta.txt"
        if meta_file.exists():
            original_name = meta_file.read_text().strip()
            doc_files = [f for f in files if f.name != "meta.txt"]
            file_path = doc_files[0] if doc_files else files[0]
        else:
            # Fallback: pakai nama file di disk (behaviour lama)
            original_name = files[0].name
            file_path = files[0]

        asyncio.run_coroutine_threadsafe(
            index_document(doc_id, file_path, original_name),
            self.loop,
        )


def start_watcher(loop: asyncio.AbstractEventLoop):
    DOCS_INBOX.mkdir(parents=True, exist_ok=True)

    handler = InboxHandler(loop)
    for existing_dir in DOCS_INBOX.iterdir():
        if existing_dir.is_dir() and existing_dir.name.startswith("doc_"):
            handler._handle_doc_dir(existing_dir)

    observer = Observer()
    observer.schedule(handler, str(DOCS_INBOX), recursive=False)
    observer.start()
    log.info("👀 Watching: %s", DOCS_INBOX)
    return observer


# ── FastAPI ───────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    loop = asyncio.get_event_loop()
    get_qdrant()
    app.state.observer = start_watcher(loop)
    log.info("🚀 Indexer siap. Collection: %s | Model: %s", COLLECTION_NAME, EMBEDDING_MODEL)
    yield
    if hasattr(app.state, "observer"):
        app.state.observer.stop()
        app.state.observer.join()

app = FastAPI(title="Document Indexer", version="1.0.0", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok", "collection": COLLECTION_NAME, "model": EMBEDDING_MODEL}


@app.delete("/delete/{doc_id}")
async def delete_document(doc_id: int):
    qdrant = get_qdrant()
    _delete_doc_vectors(qdrant, doc_id)
    log.info("Dokumen %d dihapus dari Qdrant.", doc_id)
    return {"message": f"Dokumen {doc_id} dihapus."}


@app.get("/stats")
def stats():
    qdrant = get_qdrant()
    info = qdrant.get_collection(COLLECTION_NAME)
    return {
        "collection":    COLLECTION_NAME,
        "vectors_count": info.vectors_count,
        "points_count":  info.points_count,
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=False)
