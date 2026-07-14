"""Unit tests for the RAG module (agent/rag.py).

Network-free: exercises corpus loading, chunking, and the pure formatting/source
helpers. Retrieval against a live vector store is verified separately. Runs under
pytest or directly: `uv run python test_rag.py` from the agent/ directory.
"""

from langchain_core.documents import Document

import rag


def test_load_corpus_is_official_reference_pdfs_only():
    docs = rag.load_corpus()
    files = {d.metadata.get("file") for d in docs}
    assert "nist-ir-8425a-router-profile.pdf" in files
    assert "first-cvss-v40-specification.pdf" in files
    # Provenance/reference files must not be ingested as content.
    assert "rag_corpus_reference.md" not in files
    # Official-sources-only: every ingested doc is a reference PDF (no authored MD).
    assert files and all(f.endswith(".pdf") for f in files)
    assert len(docs) == 9


def test_manifest_metadata_attached():
    nist_file = "nist-ir-8425a-router-profile.pdf"
    doc = next(d for d in rag.load_corpus() if d.metadata.get("file") == nist_file)
    assert len(doc.page_content) > 500  # PDF text actually extracted
    # Metadata propagates from the manifest onto each chunk.
    chunk = next(c for c in rag.build_documents() if c.metadata.get("file") == nist_file)
    assert chunk.metadata["doc_id"] == "DOC-001"
    assert "NIST" in chunk.metadata["title"]
    assert chunk.metadata["source_url"].startswith("https://")
    assert chunk.metadata["publish_date"]
    assert chunk.metadata["license"]
    assert chunk.metadata["ingestion_date"]  # stamped at load time
    # Citation label is the doc title (from the manifest), not the filename stem.
    assert chunk.metadata["source"] == chunk.metadata["title"]


def test_split_documents_produces_chunks_with_metadata():
    chunks = rag.build_documents()
    assert len(chunks) >= len(rag.load_corpus())
    assert all(chunk.metadata.get("source") for chunk in chunks)
    assert all("start_index" in chunk.metadata for chunk in chunks)


def _doc(source, text="body"):
    return (Document(page_content=text, metadata={"source": source}), 0.9)


def test_format_context_labels_sources_in_order():
    formatted = rag.format_context([_doc("Wi-Fi encryption", "use WPA3"), _doc("Firmware updates")])
    assert "[Source 1: Wi-Fi encryption]" in formatted
    assert "[Source 2: Firmware updates]" in formatted
    assert "use WPA3" in formatted


def test_sources_from_dedupes_preserving_order():
    results = [_doc("A"), _doc("B"), _doc("A"), _doc("C")]
    assert rag.sources_from(results) == ["A", "B", "C"]


def test_retrieve_empty_query_short_circuits_without_store():
    # Empty/blank queries must not touch the vector store (no network).
    assert rag.retrieve("") == []
    assert rag.retrieve("   ") == []


def test_tokenize_splits_alphanumeric_lowercase():
    assert rag._tokenize("WPA3 port 7547, TR-069!") == ["wpa3", "port", "7547", "tr", "069"]


def test_retrieval_mode_defaults_hybrid(monkeypatch=None):
    import os

    os.environ.pop("RAG_RETRIEVAL_MODE", None)
    assert rag._retrieval_mode() == "hybrid"
    os.environ["RAG_RETRIEVAL_MODE"] = "DENSE"
    assert rag._retrieval_mode() == "dense"
    os.environ.pop("RAG_RETRIEVAL_MODE", None)


def test_rrf_fuse_orders_by_fused_score_and_dedupes():
    a = Document(page_content="A")
    b = Document(page_content="B")
    c = Document(page_content="C")
    # dense ranks [A, B]; lexical ranks [B, C]. B appears in both -> should win.
    fused = rag._rrf_fuse([[a, b], [b, c]], k=3)
    contents = [doc.page_content for doc, _score in fused]
    assert contents[0] == "B"
    assert set(contents) == {"A", "B", "C"}  # deduped, all present


def test_bm25_matches_exact_technical_tokens():
    # BM25 is offline (no embeddings) — exact keywords should surface the right PDF.
    wpa3 = rag._bm25_docs("WPA3 SAE encryption", k=3)
    assert wpa3, "expected BM25 hits for WPA3"
    assert any("wpa3" in doc.metadata.get("file", "").lower() for doc in wpa3)
    cvss = rag._bm25_docs("CVSS base score vector string", k=3)
    assert any("cvss" in doc.metadata.get("file", "").lower() for doc in cvss)


if __name__ == "__main__":
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    for test in tests:
        test()
        print(f"ok - {test.__name__}")
    print(f"\n{len(tests)} passed")
