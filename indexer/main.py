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
import google.generativeai as genai
from langchain_text_splitters import RecursiveCharacterTextSplitter

# ── Config ────────────────────────────────────────────────────────────────────
QDRANT_URL      = os.getenv("QDRANT_URL")
COLLECTION_NAME = os.getenv("COLLECTION_NAME")
BACKEND_URL     = os.getenv("BACKEND_URL")
INDEXER_SECRET  = os.getenv("INDEXER_SECRET")
DOCS_INBOX      = Path(os.getenv("DOCS_INBOX", "/docs-inbox"))
GOOGLE_API_KEY  = os.getenv("GOOGLE_API_KEY")
EMBEDDING_MODEL = "models/gemini-embedding-2"
VECTOR_SIZE     = 3072
CHUNK_SIZE      = 1000
CHUNK_OVERLAP   = 150

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


def _init_gemini():
    if not GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY tidak di-set.")
    genai.configure(api_key=GOOGLE_API_KEY)


def embed_chunks(chunks: list[str]) -> list[list[float]]:
    _init_gemini()
    result = genai.embed_content(
        model=EMBEDDING_MODEL,
        content=chunks,
        task_type="RETRIEVAL_DOCUMENT",
    )
    embeddings = result["embedding"]
    # Single string → Gemini return flat list[float], wrap jadi list of list
    if embeddings and not isinstance(embeddings[0], list):
        return [embeddings]
    return embeddings


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
    Ekstrak teks semirip mungkin dengan cara n8n Default Data Loader:
    baca konten sebagai teks mentah, bukan parse per-cell.
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
        # Baca sebagai teks biasa — n8n juga baca CSV sebagai raw text
        return file_path.read_text(encoding="utf-8", errors="replace")

    elif suffix in (".xlsx", ".xls"):
        # Konversi ke CSV-like text supaya mirip dengan cara n8n baca
        import pandas as pd
        all_text = []
        xl = pd.ExcelFile(file_path)
        for sheet in xl.sheet_names:
            df = xl.parse(sheet)
            # Drop kolom dan baris yang semua nilainya NaN
            df = df.dropna(how="all").dropna(axis=1, how="all")
            # Export ke CSV string — mirip dengan cara n8n baca binary
            all_text.append(df.to_csv(index=False))
        return "\n".join(all_text)

    else:
        raise ValueError(f"Format tidak didukung: {suffix}")


# ── Chunking — pakai recursive character splitter mirip n8n ──────────────────
def _char_pos_to_lines(text: str, char_pos: int) -> int:
    return text[:char_pos].count("\n") + 1


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[dict]:
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
                    "to": _char_pos_to_lines(text, end) if end != -1 else 0,
                }
            },
        })
    return results


# ── Indexer core ──────────────────────────────────────────────────────────────
async def index_document(doc_id: int, file_path: Path, original_name: str):
    log.info("[doc_%d] Mulai indexing: %s", doc_id, original_name)
    try:
        text = extract_text(file_path)
        if not text.strip():
            raise ValueError("Tidak ada teks yang bisa diekstrak.")

        chunks = chunk_text(text)
        log.info("[doc_%d] %d chunks dari %d karakter", doc_id, len(chunks), len(text))

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
                        "source": "blob",
                        "blobType": blob_type,
                        "doc_id": doc_id,
                        "original_name": original_name,
                        "line": chunk["loc"]["lines"]["from"],
                        "loc": chunk["loc"],
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
        try:
            file_path.unlink(missing_ok=True)
            file_path.parent.rmdir()
        except Exception:
            pass


async def _update_status(doc_id: int, status: str, error: str = None):
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.patch(
                f"{BACKEND_URL}/api/admin/documents/{doc_id}/status",
                json={"status": status, "errorMessage": error},
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

        asyncio.run_coroutine_threadsafe(
            index_document(doc_id, files[0], files[0].name),
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
        "collection": COLLECTION_NAME,
        "vectors_count": info.vectors_count,
        "points_count": info.points_count,
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=False)
