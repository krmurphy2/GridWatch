"""Generate a synthetic RAG eval testset with Ragas and push it to LangSmith.

Two-step, with a human-review gate in between (as the course does):

  1. uv run python generate_dataset.py --size 12
       -> generates questions from the corpus, saves eval/artifacts/testset.json
  2. (review/edit testset.json by hand)
  3. uv run python generate_dataset.py --push --dataset-name gridwatch-rag-eval
       -> uploads the REVIEWED local file to a LangSmith dataset

Generation and upload are separate so synthetic questions are always reviewed
before they become a dataset. Needs OPENAI_API_KEY (or AI_GATEWAY_API_KEY); the
--push step also needs LANGSMITH_API_KEY.
"""

import argparse
import json
import sys
from typing import Any, List

from ragas.testset import TestsetGenerator

from eval_common import ARTIFACTS_DIR, corpus_documents, load_env, ragas_embeddings, ragas_llm

TESTSET_PATH = ARTIFACTS_DIR / "testset.json"


def _as_str_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    try:
        return [str(v) for v in value]
    except TypeError:
        return [str(value)]


def generate(size: int) -> List[dict]:
    documents = corpus_documents()
    generator = TestsetGenerator(llm=ragas_llm(), embedding_model=ragas_embeddings())
    # raise_exceptions=False: stock Ragas drives its knowledge-graph transforms with
    # LangChain output parsers, which occasionally fail to parse a model's output.
    # Tolerate those individual failures and keep whatever generated cleanly rather
    # than aborting the whole run.
    testset = generator.generate_with_langchain_docs(
        documents, testset_size=size, raise_exceptions=False
    )
    df = testset.to_pandas()

    records = []
    for _, row in df.iterrows():
        records.append(
            {
                "user_input": str(row["user_input"]),
                "reference": str(row.get("reference", "")),
                "reference_contexts": _as_str_list(row.get("reference_contexts")),
                "synthesizer_name": str(row.get("synthesizer_name", "")),
            }
        )
    return records


def push(dataset_name: str) -> None:
    if not TESTSET_PATH.exists():
        print(f"No {TESTSET_PATH} found. Run generation first, then review it.")
        sys.exit(1)

    from langsmith import Client

    records = json.loads(TESTSET_PATH.read_text())
    client = Client()
    dataset = client.create_dataset(
        dataset_name=dataset_name,
        description="GridWatch synthetic RAG evaluation set (human-reviewed).",
    )
    client.create_examples(
        dataset_id=dataset.id,
        examples=[
            {
                "inputs": {"question": r["user_input"]},
                "outputs": {"reference": r["reference"], "reference_contexts": r["reference_contexts"]},
                "metadata": {"synthesizer_name": r["synthesizer_name"], "synthetic": True},
            }
            for r in records
        ],
    )
    print(f"Pushed {len(records)} examples to LangSmith dataset '{dataset_name}'.")


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser(description="Generate/push the GridWatch RAG eval testset.")
    parser.add_argument("--size", type=int, default=12, help="number of synthetic questions to generate")
    parser.add_argument("--push", action="store_true", help="upload the reviewed local testset to LangSmith")
    parser.add_argument("--dataset-name", default="gridwatch-rag-eval", help="LangSmith dataset name")
    args = parser.parse_args()

    if args.push:
        push(args.dataset_name)
        return 0

    records = generate(args.size)
    ARTIFACTS_DIR.mkdir(exist_ok=True)
    TESTSET_PATH.write_text(json.dumps(records, indent=2))
    print(f"Generated {len(records)} questions -> {TESTSET_PATH}")
    print("Review/edit that file, then run with --push to upload to LangSmith.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
