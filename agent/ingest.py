"""Build/refresh the Qdrant Cloud collection for the security-guidance corpus.

Run once, and again whenever the corpus changes, against Qdrant Cloud:

    QDRANT_URL=... QDRANT_API_KEY=... uv run python ingest.py

Also needs the embedding provider env (OPENAI_API_KEY, or AI_GATEWAY_API_KEY to go
through the gateway). Local development does NOT need this — rag.py builds an
in-memory index automatically when QDRANT_URL is unset.
"""

import os
import sys

from llm import get_embeddings
from rag import COLLECTION_NAME, build_documents


def main() -> int:
    url = os.getenv("QDRANT_URL")
    if not url:
        print("QDRANT_URL is not set — nothing to ingest into. Aborting.")
        return 1

    documents = build_documents()
    if not documents:
        print("No corpus documents found under agent/corpus. Aborting.")
        return 1

    from langchain_qdrant import QdrantVectorStore

    print(f"Ingesting {len(documents)} chunks into '{COLLECTION_NAME}' at {url} ...")
    QdrantVectorStore.from_documents(
        documents,
        embedding=get_embeddings(),
        url=url,
        api_key=os.getenv("QDRANT_API_KEY"),
        collection_name=COLLECTION_NAME,
        force_recreate=True,
    )
    print("Done. Collection rebuilt.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
