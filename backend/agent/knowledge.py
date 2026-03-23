"""
Knowledge base system with ChromaDB vector store.
Handles document ingestion, chunking, embedding, and retrieval.
"""

import os
import uuid
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from langchain_core.tools import tool
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import (
    PyPDFLoader,
    TextLoader,
    CSVLoader,
    JSONLoader,
    UnstructuredMarkdownLoader,
)

UPLOADS_DIR = Path(__file__).parent.parent / "uploads"
CHROMA_DIR = Path(__file__).parent.parent / "chroma_db"
METADATA_FILE = UPLOADS_DIR / "_metadata.json"

_vectorstore = None
_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    separators=["\n\n", "\n", ". ", " ", ""],
)


def _load_metadata() -> list[dict]:
    if METADATA_FILE.exists():
        return json.loads(METADATA_FILE.read_text())
    return []


def _save_metadata(metadata: list[dict]):
    METADATA_FILE.write_text(json.dumps(metadata, indent=2, ensure_ascii=False))


def get_vectorstore():
    """Lazy-init ChromaDB with sentence-transformers embeddings."""
    global _vectorstore
    if _vectorstore is None:
        from langchain_chroma import Chroma
        from chromadb.config import Settings as ChromaSettings
        import chromadb

        try:
            from langchain_community.embeddings import (
                HuggingFaceEmbeddings,
            )
            embeddings = HuggingFaceEmbeddings(
                model_name="sentence-transformers/all-MiniLM-L6-v2"
            )
        except Exception:
            from langchain_community.embeddings import FakeEmbeddings
            embeddings = FakeEmbeddings(size=384)

        client = chromadb.PersistentClient(
            path=str(CHROMA_DIR),
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        _vectorstore = Chroma(
            client=client,
            collection_name="vydalitics_knowledge",
            embedding_function=embeddings,
        )
    return _vectorstore


async def ingest_file(file_path: str, original_name: str) -> dict:
    """Load a file, chunk it, embed it, and store in ChromaDB."""
    ext = Path(original_name).suffix.lower()
    loader_map = {
        ".pdf": lambda p: PyPDFLoader(p),
        ".txt": lambda p: TextLoader(p, encoding="utf-8"),
        ".md": lambda p: UnstructuredMarkdownLoader(p),
        ".csv": lambda p: CSVLoader(p, encoding="utf-8"),
        ".json": lambda p: JSONLoader(p, jq_schema=".", text_content=False),
    }

    loader_fn = loader_map.get(ext)
    if not loader_fn:
        raise ValueError(f"Formato file non supportato: {ext}. Supportati: {', '.join(loader_map.keys())}")

    loader = loader_fn(file_path)
    documents = loader.load()

    doc_id = str(uuid.uuid4())[:8]
    for doc in documents:
        doc.metadata["source_file"] = original_name
        doc.metadata["doc_id"] = doc_id
        doc.metadata["uploaded_at"] = datetime.now().isoformat()
        doc.metadata["file_type"] = ext

    chunks = _splitter.split_documents(documents)

    vs = get_vectorstore()
    chunk_ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
    vs.add_documents(chunks, ids=chunk_ids)

    meta_entry = {
        "id": doc_id,
        "filename": original_name,
        "file_type": ext,
        "chunks": len(chunks),
        "uploaded_at": datetime.now().isoformat(),
        "file_path": file_path,
    }
    all_meta = _load_metadata()
    all_meta.append(meta_entry)
    _save_metadata(all_meta)

    return meta_entry


def list_documents() -> list[dict]:
    """Return metadata of all uploaded documents."""
    return _load_metadata()


def delete_document(doc_id: str) -> bool:
    """Remove a document and its chunks from the vector store."""
    all_meta = _load_metadata()
    doc = next((d for d in all_meta if d["id"] == doc_id), None)
    if not doc:
        return False

    vs = get_vectorstore()
    try:
        vs.delete(where={"doc_id": doc_id})
    except Exception:
        existing = vs.get(where={"doc_id": doc_id})
        if existing and existing.get("ids"):
            vs.delete(ids=existing["ids"])

    if doc.get("file_path") and os.path.exists(doc["file_path"]):
        os.remove(doc["file_path"])

    all_meta = [d for d in all_meta if d["id"] != doc_id]
    _save_metadata(all_meta)
    return True


# ── LangChain Tools ──────────────────────────────────────────────────


@tool
async def search_knowledge(query: str) -> str:
    """Search the uploaded knowledge base (copywriting docs, frameworks, swipe files,
    structured data) for information relevant to the query.
    Returns the most relevant text chunks with source attribution.
    Use this when the user asks about copywriting principles, references uploaded material,
    or when you need context from their knowledge base to make recommendations."""
    vs = get_vectorstore()
    results = vs.similarity_search(query, k=5)
    if not results:
        return "Nessun risultato trovato nella knowledge base. Assicurati di aver caricato dei documenti."
    output = []
    for i, doc in enumerate(results, 1):
        source = doc.metadata.get("source_file", "sconosciuto")
        output.append(f"**[{i}] Da: {source}**\n{doc.page_content}\n")
    return "**Risultati dalla Knowledge Base:**\n\n" + "\n---\n".join(output)


@tool
async def analyze_copy_performance(video_id: str) -> str:
    """Cross-reference a video's performance data with knowledge base insights.
    Fetches the video's stats and searches the knowledge base for relevant
    copywriting/marketing principles to provide actionable recommendations.
    Use this when the user wants copy improvement suggestions based on data."""
    from .tools import _get, _unwrap_content, _unwrap_data

    raw_stats = await _get(f"/stats/video/{video_id}")
    stats = _unwrap_content(raw_stats)
    raw_videos = await _get("/video")
    videos = _unwrap_data(raw_videos)
    video = next((v for v in videos if v["id"] == video_id), None) if isinstance(videos, list) else None
    video_name = video.get("title", video_id) if video else video_id

    context_queries = [
        f"video marketing conversion rate optimization",
        f"engagement watch time improvement copywriting",
        f"CTA click through rate best practices",
    ]

    vs = get_vectorstore()
    knowledge_chunks = []
    for q in context_queries:
        results = vs.similarity_search(q, k=2)
        knowledge_chunks.extend(results)

    kb_text = ""
    if knowledge_chunks:
        seen = set()
        for doc in knowledge_chunks:
            content = doc.page_content[:300]
            if content not in seen:
                seen.add(content)
                kb_text += f"- {doc.metadata.get('source_file', '?')}: {content}...\n"

    conv_rate = stats.get("conversionRate", 0) or stats.get("conversion_rate", 0)
    play_rate = stats.get("playRate", 0) or stats.get("play_rate", 0)
    avg_pct = stats.get("avgPercentWatched", 0) or stats.get("avg_percent_watched", 0)
    cta_rate = stats.get("ctaClickRate", 0) or stats.get("cta_click_rate", 0)

    analysis = (
        f"**Analisi Copy-Performance per \"{video_name}\":**\n\n"
        f"**Metriche attuali:**\n"
        f"- Play Rate: {play_rate * 100:.1f}%\n"
        f"- % Media Vista: {avg_pct * 100:.1f}%\n"
        f"- Tasso Conversione: {conv_rate * 100:.1f}%\n"
        f"- CTA Click Rate: {cta_rate * 100:.1f}%\n\n"
    )

    if kb_text:
        analysis += f"**Insight dalla Knowledge Base:**\n{kb_text}\n"
    else:
        analysis += "*Nessun documento nella knowledge base. Carica framework di copywriting per insight migliori.*\n"

    return analysis


def get_knowledge_tools() -> list:
    """Return knowledge-related tools for the agent."""
    return [search_knowledge, analyze_copy_performance]
