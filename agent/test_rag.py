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


if __name__ == "__main__":
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    for test in tests:
        test()
        print(f"ok - {test.__name__}")
    print(f"\n{len(tests)} passed")
