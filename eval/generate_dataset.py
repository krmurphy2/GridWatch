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

from langchain_core.documents import Document
from ragas.testset import TestsetGenerator
from ragas.testset.persona import Persona
from ragas.testset.synthesizers import (
    MultiHopAbstractQuerySynthesizer,
    MultiHopSpecificQuerySynthesizer,
    SingleHopSpecificQuerySynthesizer,
)

from eval_common import (
    ARTIFACTS_DIR,
    CORPUS_DIR,
    TESTSET_PATH,
    _load_pdf_text,
    load_env,
    ragas_embeddings,
    ragas_llm,
)

# Consumer-facing docs produce the most useful everyday questions; the dense specs
# (OWASP ISTG, WPA3 spec, CVSS spec) are excluded from GENERATION to bound knowledge-
# graph cost and keep question style plain. Use --all-docs to include everything.
CONSUMER_DOCS = {
    "nsa-securing-home-network.pdf",
    "ftc-secure-home-wifi.pdf",
    "cisa-project-upskill-module5-home-wifi.pdf",
    "nist-ir-8425a-router-profile.pdf",
    "first-cvss-v40-user-guide.pdf",
    "fbi-ic3-eol-routers-proxy-2025.pdf",
}

# Personas bias the generator toward our two target voices.
PERSONAS = [
    Persona(
        name="Everyday home user",
        role_description=(
            "A non-technical home user who does not know router jargon, ports, or CVEs. "
            "Asks short, practical questions in clear, correctly-spelled plain English — "
            "complete sentences, no slang, texting abbreviations, or typos."
        ),
    ),
    Persona(
        name="Tech-curious home user",
        role_description=(
            "A home user comfortable with some technical detail. Asks specific, "
            "well-formed questions about settings, protocols like WPA3, vulnerability "
            "severity (CVSS), and why a finding matters. Writes clearly and correctly."
        ),
    ),
]


def _as_str_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    try:
        return [str(v) for v in value]
    except TypeError:
        return [str(value)]


def _generation_documents(all_docs: bool) -> List[Document]:
    """Whole reference PDFs to generate from (consumer subset unless --all-docs)."""
    paths = sorted(CORPUS_DIR.glob("*.pdf"))
    if not all_docs:
        paths = [p for p in paths if p.name in CONSUMER_DOCS]
    documents: List[Document] = []
    for path in paths:
        text = _load_pdf_text(path)
        if text.strip():
            documents.append(Document(page_content=text, metadata={"source": path.stem, "file": path.name}))
    return documents


def generate(size: int, all_docs: bool = False) -> List[dict]:
    documents = _generation_documents(all_docs)
    llm = ragas_llm()
    # Single-hop-heavy so most questions are simple/factual (everyday user), with a
    # minority of multi-hop for the more technical, cross-document questions.
    distribution = [
        (SingleHopSpecificQuerySynthesizer(llm=llm), 0.6),
        (MultiHopSpecificQuerySynthesizer(llm=llm), 0.25),
        (MultiHopAbstractQuerySynthesizer(llm=llm), 0.15),
    ]
    generator = TestsetGenerator(llm=llm, embedding_model=ragas_embeddings(), persona_list=PERSONAS)
    # raise_exceptions=False: tolerate occasional Ragas output-parse failures on
    # individual knowledge-graph transforms rather than aborting the whole run.
    testset = generator.generate_with_langchain_docs(
        documents,
        testset_size=size,
        query_distribution=distribution,
        raise_exceptions=False,
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


def push(dataset_name: str, replace: bool = False) -> None:
    if not TESTSET_PATH.exists():
        print(f"No {TESTSET_PATH} found. Run generation first, then review it.")
        sys.exit(1)

    from langsmith import Client

    records = json.loads(TESTSET_PATH.read_text())
    client = Client()

    # LangSmith rejects a duplicate dataset name. Reuse the canonical dataset by
    # deleting + recreating it so it exactly matches the current testset.json (no
    # duplicate examples). Push the dataset BEFORE running experiments on it.
    if client.has_dataset(dataset_name=dataset_name):
        if not replace:
            print(
                f"Dataset '{dataset_name}' already exists. Re-run with --replace to "
                f"overwrite it, or pass a different --dataset-name for a new one."
            )
            sys.exit(1)
        client.delete_dataset(dataset_name=dataset_name)
        print(f"Replaced existing dataset '{dataset_name}'.")

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
    parser.add_argument("--size", type=int, default=15, help="number of synthetic questions to generate")
    parser.add_argument("--all-docs", action="store_true", help="generate from the full corpus, not just consumer-facing docs")
    parser.add_argument("--push", action="store_true", help="upload the reviewed local testset to LangSmith")
    parser.add_argument("--replace", action="store_true", help="overwrite the LangSmith dataset if it already exists")
    parser.add_argument("--dataset-name", default="gridwatch-rag-eval", help="LangSmith dataset name")
    args = parser.parse_args()

    if args.push:
        push(args.dataset_name, replace=args.replace)
        return 0

    records = generate(args.size, all_docs=args.all_docs)
    ARTIFACTS_DIR.mkdir(exist_ok=True)
    TESTSET_PATH.write_text(json.dumps(records, indent=2))
    print(f"Generated {len(records)} questions -> {TESTSET_PATH}")
    print("Review/edit that file, then run with --push to upload to LangSmith.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
