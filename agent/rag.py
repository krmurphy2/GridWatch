"""RAG over GridWatch's trusted home-network security guidance corpus.

The corpus (agent/corpus/*.md) is project-authored, plain-English guidance that
cites authoritative sources (CISA, OWASP, CIS, NVD). It is chunked, embedded with
the shared embedding model, and indexed in Qdrant.

Two deployment modes:
- Local/dev: no QDRANT_URL -> an in-memory Qdrant is built from the corpus on first
  use (rebuilt per process; fine for development and evaluations).
- Production: QDRANT_URL (+ QDRANT_API_KEY) set -> connect to an existing Qdrant
  Cloud collection populated offline by ingest.py, so nothing is re-embedded on the
  request path.

Retrieval is best-effort: if the store cannot be built or reached, it returns no
results and callers degrade gracefully rather than failing the request.
"""

import os
import re
from functools import lru_cache
from pathlib import Path
from typing import List, Tuple

from langchain_core.documents import Document
from langchain_core.tools import tool
from langchain_text_splitters import RecursiveCharacterTextSplitter

from llm import get_embeddings

CORPUS_DIR = Path(__file__).resolve().parent / "corpus"
COLLECTION_NAME = os.getenv("QDRANT_COLLECTION", "gridwatch_security_guidance")
DEFAULT_RETRIEVAL_K = int(os.getenv("RAG_RETRIEVAL_K", "4"))
# Candidate pool each retriever contributes before fusion (hybrid mode).
FIRST_STAGE_K = int(os.getenv("RAG_FIRST_STAGE_K", "8"))
RRF_CONSTANT = 60

CHUNK_SIZE = 900
CHUNK_OVERLAP = 120
# Markdown-aware separators so chunks break on headings/paragraphs first.
_SEPARATORS = ["\n## ", "\n### ", "\n\n", "\n", ". ", " "]

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _retrieval_mode() -> str:
    """'hybrid' (dense + BM25 fused, default) or 'dense' (semantic only)."""
    return os.getenv("RAG_RETRIEVAL_MODE", "hybrid").strip().lower()


def _tokenize(text: str) -> List[str]:
    return _TOKEN_RE.findall(text.lower())


def _source_label(text: str, fallback: str) -> str:
    """Use the doc's first H1 as its citation label; fall back to the filename."""
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    return fallback


def load_corpus() -> List[Document]:
    """Load the markdown corpus into Documents (metadata source = doc title)."""
    documents: List[Document] = []
    if not CORPUS_DIR.is_dir():
        return documents
    for path in sorted(CORPUS_DIR.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        if not text.strip():
            continue
        documents.append(
            Document(
                page_content=text,
                metadata={"source": _source_label(text, path.stem), "file": path.name},
            )
        )
    return documents


def split_documents(documents: List[Document]) -> List[Document]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        add_start_index=True,
        separators=_SEPARATORS,
    )
    return splitter.split_documents(documents)


def build_documents() -> List[Document]:
    """Corpus -> chunked Documents, ready to embed/index."""
    return split_documents(load_corpus())


@lru_cache(maxsize=1)
def _vector_store():
    """Build (in-memory) or connect to (cloud) the Qdrant store. Cached per process."""
    from langchain_qdrant import QdrantVectorStore  # lazy: keeps pure-fn tests import-light

    embeddings = get_embeddings()

    if os.getenv("QDRANT_URL"):
        # Production: connect to the collection ingest.py already populated.
        return QdrantVectorStore.from_existing_collection(
            embedding=embeddings,
            collection_name=COLLECTION_NAME,
            url=os.getenv("QDRANT_URL"),
            api_key=os.getenv("QDRANT_API_KEY"),
        )

    # Local/dev: ephemeral in-memory index built from the bundled corpus.
    return QdrantVectorStore.from_documents(
        build_documents(),
        embedding=embeddings,
        location=":memory:",
        collection_name=COLLECTION_NAME,
    )


@lru_cache(maxsize=1)
def _bm25_index():
    """BM25 over the bundled corpus chunks (lexical / exact-keyword retrieval)."""
    from rank_bm25 import BM25Okapi

    chunks = build_documents()
    bm25 = BM25Okapi([_tokenize(chunk.page_content) for chunk in chunks])
    return bm25, chunks


def _dense_docs(query: str, k: int) -> List[Document]:
    return [doc for doc, _score in _vector_store().similarity_search_with_score(query, k=k)]


def _bm25_docs(query: str, k: int) -> List[Document]:
    bm25, chunks = _bm25_index()
    scores = bm25.get_scores(_tokenize(query))
    order = sorted(range(len(chunks)), key=lambda i: scores[i], reverse=True)
    return [chunks[i] for i in order[:k] if scores[i] > 0]


def _rrf_fuse(ranked_lists: List[List[Document]], k: int) -> List[Tuple[Document, float]]:
    """Reciprocal Rank Fusion: combine rankings by 1/(c + rank), lists weighted equally.

    Chunks are keyed by content so the same chunk from the dense and lexical lists
    reinforces instead of duplicating.
    """
    scores: dict = {}
    docs: dict = {}
    for ranked in ranked_lists:
        for rank, doc in enumerate(ranked):
            key = doc.page_content
            scores[key] = scores.get(key, 0.0) + 1.0 / (RRF_CONSTANT + rank + 1)
            docs.setdefault(key, doc)
    ordered = sorted(scores.keys(), key=lambda key: scores[key], reverse=True)
    return [(docs[key], scores[key]) for key in ordered[:k]]


def retrieve(query: str, k: int = DEFAULT_RETRIEVAL_K) -> List[Tuple[Document, float]]:
    """Return up to k (Document, score) matches. Best-effort: [] on any failure.

    Hybrid mode (default) fuses dense (semantic) and BM25 (exact-keyword) results
    with Reciprocal Rank Fusion, so exact technical tokens — CVE ids, port numbers,
    protocol names like WPA3 or TR-069 — aren't missed by embeddings alone.
    RAG_RETRIEVAL_MODE=dense falls back to semantic-only.
    """
    if not query or not query.strip():
        return []
    try:
        if _retrieval_mode() == "dense":
            return _vector_store().similarity_search_with_score(query, k=k)
        dense = _dense_docs(query, FIRST_STAGE_K)
        lexical = _bm25_docs(query, FIRST_STAGE_K)
        return _rrf_fuse([dense, lexical], k)
    except Exception:
        # Retrieval is enrichment, not load-bearing — never fail the caller.
        return []


def format_context(results: List[Tuple[Document, float]]) -> str:
    """Render results as source-labeled context blocks for a prompt."""
    blocks = []
    for index, (doc, _score) in enumerate(results, start=1):
        source = doc.metadata.get("source", "guidance")
        blocks.append(f"[Source {index}: {source}]\n{doc.page_content.strip()}")
    return "\n\n".join(blocks)


def sources_from(results: List[Tuple[Document, float]]) -> List[str]:
    """Distinct source titles in first-seen order, for citation display."""
    seen: List[str] = []
    for doc, _score in results:
        source = doc.metadata.get("source", "guidance")
        if source not in seen:
            seen.append(source)
    return seen


@tool
def retrieve_security_guidance(query: str) -> str:
    """Search GridWatch's trusted home-network security guidance for context about
    router hardening, remote admin, UPnP and port forwarding, Wi-Fi encryption,
    firmware updates, exposed ports and services, interpreting vulnerabilities
    (CVEs), and reading passive internet-exposure results. Use this whenever the
    user asks how to fix or understand a home-network security issue."""
    results = retrieve(query)
    if not results:
        return "No relevant security guidance was found in the corpus."
    return format_context(results)
