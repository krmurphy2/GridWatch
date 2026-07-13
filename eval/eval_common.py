"""Shared helpers for the GridWatch RAG evaluation harness.

This project is intentionally isolated from the deployed agent (its own venv)
because Ragas pins conflict with the agent's LangChain 1.x deps. It reuses the
SAME corpus and the same chunking/embedding/retrieval settings as production so
the numbers reflect the shipped pipeline.
"""

import os
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

# Mirror production retrieval config (agent/rag.py) so eval measures the real thing.
CHUNK_SIZE = 900
CHUNK_OVERLAP = 120
_SEPARATORS = ["\n## ", "\n### ", "\n\n", "\n", ". ", " "]
RETRIEVAL_K = int(os.getenv("RAG_RETRIEVAL_K", "4"))

_ANSWER_PROMPT = (
    "You are GridWatch, helping a non-technical home user. Answer the question using "
    "ONLY the guidance below. Be concise and plain-spoken. If the guidance does not "
    "cover it, say you don't have guidance on that.\n\nGUIDANCE:\n{context}\n\n"
    "QUESTION: {question}\n\nANSWER:"
)


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


def corpus_documents() -> List[Document]:
    """Load + chunk the shared corpus exactly as production does."""
    docs: List[Document] = []
    for path in sorted(CORPUS_DIR.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        if text.strip():
            docs.append(Document(page_content=text, metadata={"source": _source_label(text, path.stem)}))
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP, add_start_index=True, separators=_SEPARATORS
    )
    return splitter.split_documents(docs)


def build_rag():
    """Build an in-memory RAG pipeline over the corpus.

    Returns an `answer(question) -> (response_text, [context_texts])` callable that
    retrieves top-K chunks and generates a grounded answer, capturing the exact
    contexts used so faithfulness/recall can be scored.
    """
    store = QdrantVectorStore.from_documents(
        corpus_documents(),
        embedding=embeddings(),
        location=":memory:",
        collection_name="gridwatch_eval",
    )
    llm = chat_model()

    def answer(question: str) -> Tuple[str, List[str]]:
        docs = store.similarity_search(question, k=RETRIEVAL_K)
        contexts = [d.page_content for d in docs]
        prompt = _ANSWER_PROMPT.format(context="\n\n".join(contexts), question=question)
        response = llm.invoke(prompt)
        text = response.content if isinstance(response.content, str) else str(response.content)
        return text, contexts

    return answer
