"""Unit tests for the RAG module (agent/rag.py).

Network-free: exercises corpus loading, chunking, and the pure formatting/source
helpers. Retrieval against a live vector store is verified separately. Runs under
pytest or directly: `uv run python test_rag.py` from the agent/ directory.
"""

from langchain_core.documents import Document

import rag


def test_load_corpus_uses_h1_titles_as_source():
    docs = rag.load_corpus()
    assert len(docs) >= 5
    for doc in docs:
        assert doc.metadata["source"]
        # Title comes from the first H1, not the raw filename stem.
        assert doc.metadata["source"] != doc.metadata["file"]


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
    # BM25 is offline (no embeddings) — exact keywords should surface the right doc.
    top = rag._bm25_docs("UPnP", k=3)
    assert top, "expected BM25 hits for UPnP"
    assert any("UPnP" in doc.metadata.get("source", "") for doc in top)
    ports = rag._bm25_docs("TR-069 port 7547", k=3)
    assert any("ports" in doc.metadata.get("source", "").lower() for doc in ports)


if __name__ == "__main__":
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    for test in tests:
        test()
        print(f"ok - {test.__name__}")
    print(f"\n{len(tests)} passed")
