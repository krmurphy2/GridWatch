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

CHUNK_SIZE = 900
CHUNK_OVERLAP = 120
# Markdown-aware separators so chunks break on headings/paragraphs first.
_SEPARATORS = ["\n## ", "\n### ", "\n\n", "\n", ". ", " "]


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


def retrieve(query: str, k: int = DEFAULT_RETRIEVAL_K) -> List[Tuple[Document, float]]:
    """Return up to k (Document, score) matches. Best-effort: [] on any failure."""
    if not query or not query.strip():
        return []
    try:
        store = _vector_store()
        return store.similarity_search_with_score(query, k=k)
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
