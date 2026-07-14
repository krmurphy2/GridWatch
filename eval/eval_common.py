"""Shared helpers for the GridWatch RAG evaluation harness.

This project is intentionally isolated from the deployed agent (its own venv)
because Ragas pins conflict with the agent's LangChain 1.x deps. It reuses the
SAME corpus and the same chunking/embedding/retrieval settings as production so
the numbers reflect the shipped pipeline.
"""

import os
import re
from pathlib import Path
from typing import List, Tuple

from dotenv import load_dotenv
from langchain_core.documents import Document
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Corpus lives with the agent; eval/ is its sibling.
CORPUS_DIR = Path(__file__).resolve().parent.parent / "agent" / "corpus"
ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"
# Curated eval dataset — committed (not under gitignored artifacts/) so it can be
# reviewed. generate_dataset.py writes a draft here; curate it in place.
TESTSET_PATH = Path(__file__).resolve().parent / "testset.json"

# Mirror production retrieval config (agent/rag.py) so eval measures the real thing.
CHUNK_SIZE = 900
CHUNK_OVERLAP = 120
_SEPARATORS = ["\n## ", "\n### ", "\n\n", "\n", ". ", " "]
RETRIEVAL_K = int(os.getenv("RAG_RETRIEVAL_K", "4"))
FIRST_STAGE_K = int(os.getenv("RAG_FIRST_STAGE_K", "8"))
RRF_CONSTANT = 60

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokenize(text: str) -> List[str]:
    return _TOKEN_RE.findall(text.lower())

# Baseline answer prompt (the Task 5 pipeline).
_BASELINE_ANSWER_PROMPT = (
    "You are GridWatch, helping a non-technical home user. Answer the question using "
    "ONLY the guidance below. Be concise and plain-spoken. If the guidance does not "
    "cover it, say you don't have guidance on that.\n\nGUIDANCE:\n{context}\n\n"
    "QUESTION: {question}\n\nANSWER:"
)

# Grounded answer prompt (Task 6 non-retrieval improvement): a hard no-outside-
# knowledge boundary plus a self-verification pass, which is the main lever for
# Ragas faithfulness (dropping claims not supported by the retrieved context).
_GROUNDED_ANSWER_PROMPT = (
    "You are GridWatch, helping a non-technical home user. Answer using ONLY the "
    "guidance below. Do NOT add security advice from general knowledge, even if it is "
    "correct. If the guidance does not cover the question, say you don't have guidance "
    "on that rather than guessing.\n\n"
    "Before finalizing, re-read your answer and delete any sentence that is not "
    "directly supported by the guidance. Be concise and plain-spoken.\n\n"
    "GUIDANCE:\n{context}\n\nQUESTION: {question}\n\nANSWER:"
)

_ANSWER_PROMPTS = {"baseline": _BASELINE_ANSWER_PROMPT, "grounded": _GROUNDED_ANSWER_PROMPT}


def load_env() -> None:
    load_dotenv(Path(__file__).resolve().parent / ".env")


def _gateway_kwargs() -> Tuple[dict, bool]:
    """Match agent/llm.py: route through the Vercel AI Gateway when configured."""
    key = os.getenv("AI_GATEWAY_API_KEY")
    if key:
        base_url = os.getenv("AI_GATEWAY_BASE_URL", "https://ai-gateway.vercel.sh/v1")
        return {"api_key": key, "base_url": base_url}, True
    return {}, False


def _model_id(raw: str, use_gateway: bool) -> str:
    if use_gateway:
        return raw if "/" in raw else f"openai/{raw}"
    return raw[len("openai/"):] if raw.startswith("openai/") else raw


def chat_model(temperature: float = 0.0) -> ChatOpenAI:
    kwargs, gateway = _gateway_kwargs()
    model = _model_id(os.getenv("EVAL_MODEL", "gpt-5.1"), gateway)
    return ChatOpenAI(model=model, temperature=temperature, **kwargs)


def embeddings() -> OpenAIEmbeddings:
    kwargs, gateway = _gateway_kwargs()
    model = _model_id(os.getenv("EVAL_EMBEDDING_MODEL", "text-embedding-3-small"), gateway)
    return OpenAIEmbeddings(model=model, **kwargs)


def _openai_client(is_async: bool = False):
    from openai import AsyncOpenAI, OpenAI

    kwargs, _ = _gateway_kwargs()
    cls = AsyncOpenAI if is_async else OpenAI
    return cls(**kwargs) if kwargs else cls()


def ragas_llm(is_async: bool = False):
    """Ragas LLM via llm_factory (instructor tool-mode).

    This forces structured output through tool calls rather than Ragas's default
    text-parsing path, which is fragile — models routinely return prose where
    Ragas expects JSON. Synthetic generation drives it synchronously; metric
    scoring's .ascore() needs an async client, hence the flag.
    """
    from ragas.llms import llm_factory

    _, gateway = _gateway_kwargs()
    model = _model_id(os.getenv("EVAL_MODEL", "gpt-5.1"), gateway)
    llm = llm_factory(model, provider="openai", client=_openai_client(is_async))
    # llm_factory defaults to {temperature, top_p, max_tokens}. Newer OpenAI models
    # (gpt-5.x) reject max_tokens (want max_completion_tokens) and non-default
    # temperature/top_p, so set only the modern token cap.
    # Generous cap: on gpt-5.x, hidden reasoning tokens also count against this, so
    # a small limit truncates structured output mid-generation.
    llm.model_args = {"max_completion_tokens": int(os.getenv("EVAL_MAX_TOKENS", "8192"))}
    return llm


def ragas_embeddings():
    from ragas.embeddings import LangchainEmbeddingsWrapper

    return LangchainEmbeddingsWrapper(embeddings())


def _source_label(text: str, fallback: str) -> str:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    return fallback


_EXCLUDE_MD = {"rag_corpus_reference.md", "SOURCES.md"}
_LIGATURES = {"ﬁ": "fi", "ﬂ": "fl", "ﬀ": "ff", "ﬃ": "ffi", "ﬄ": "ffl"}


def _load_pdf_text(path: Path) -> str:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    text = "\n".join((page.extract_text() or "") for page in reader.pages)
    # Mirror agent/rag.py cleanup so eval retrieval matches production.
    for bad, good in _LIGATURES.items():
        text = text.replace(bad, good)
    text = re.sub(r"-\n(?=\w)", "", text)
    text = "\n".join(ln for ln in text.splitlines() if not re.fullmatch(r"\s*\d{1,4}\s*", ln))
    text = re.sub(r"[ \t]{2,}", " ", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def corpus_documents() -> List[Document]:
    """Load + chunk the shared corpus exactly as production does (reference PDFs)."""
    docs: List[Document] = []
    for path in sorted(CORPUS_DIR.glob("*.pdf")):
        text = _load_pdf_text(path)
        if text.strip():
            docs.append(Document(page_content=text, metadata={"source": path.stem}))
    for path in sorted(CORPUS_DIR.glob("*.md")):
        if path.name in _EXCLUDE_MD:
            continue
        text = path.read_text(encoding="utf-8")
        if text.strip():
            docs.append(Document(page_content=text, metadata={"source": _source_label(text, path.stem)}))
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP, add_start_index=True, separators=_SEPARATORS
    )
    return splitter.split_documents(docs)


def build_rag(mode: str = "hybrid", prompt_style: str = "grounded"):
    """Build an in-memory RAG pipeline over the corpus (mirrors agent/rag.py).

    mode="dense": semantic search only (the Task 5 baseline).
    mode="hybrid": dense + BM25 fused with Reciprocal Rank Fusion (the Task 6
    advanced retriever).
    prompt_style="baseline"|"grounded": which answer prompt to use (Task 6
    non-retrieval improvement A/B).

    Returns an `answer(question) -> (response_text, [context_texts])` callable that
    captures the exact contexts used so faithfulness/recall can be scored.
    """
    from rank_bm25 import BM25Okapi

    answer_prompt = _ANSWER_PROMPTS[prompt_style]
    documents = corpus_documents()
    store = QdrantVectorStore.from_documents(
        documents, embedding=embeddings(), location=":memory:", collection_name="gridwatch_eval"
    )
    bm25 = BM25Okapi([_tokenize(doc.page_content) for doc in documents])
    llm = chat_model()

    def _dense(query: str, k: int) -> List[Document]:
        return store.similarity_search(query, k=k)

    def _bm25(query: str, k: int) -> List[Document]:
        scores = bm25.get_scores(_tokenize(query))
        order = sorted(range(len(documents)), key=lambda i: scores[i], reverse=True)
        return [documents[i] for i in order[:k] if scores[i] > 0]

    def _rrf(ranked_lists: List[List[Document]], k: int) -> List[Document]:
        fused: dict = {}
        docs: dict = {}
        for ranked in ranked_lists:
            for rank, doc in enumerate(ranked):
                key = doc.page_content
                fused[key] = fused.get(key, 0.0) + 1.0 / (RRF_CONSTANT + rank + 1)
                docs.setdefault(key, doc)
        return [docs[key] for key in sorted(fused, key=lambda key: fused[key], reverse=True)[:k]]

    def _retrieve(query: str) -> List[Document]:
        if mode == "dense":
            return _dense(query, RETRIEVAL_K)
        return _rrf([_dense(query, FIRST_STAGE_K), _bm25(query, FIRST_STAGE_K)], RETRIEVAL_K)

    def answer(question: str) -> Tuple[str, List[str]]:
        contexts = [doc.page_content for doc in _retrieve(question)]
        prompt = answer_prompt.format(context="\n\n".join(contexts), question=question)
        response = llm.invoke(prompt)
        text = response.content if isinstance(response.content, str) else str(response.content)
        return text, contexts

    return answer
