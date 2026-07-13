"""Run the GridWatch RAG pipeline over the eval testset and score it with Ragas.

  uv run python run_eval.py                 # pull questions from the LangSmith dataset
  uv run python run_eval.py --local         # use eval/artifacts/testset.json instead

For each question it retrieves context, generates an answer, then scores the batch
with Ragas (Faithfulness, LLM Context Recall, Factual Correctness) and writes a
results table to eval/artifacts/. That table is the Task 5 baseline and the thing
Task 6 compares an advanced retriever against.
"""

import argparse
import asyncio
import json
import sys

from eval_common import ARTIFACTS_DIR, build_rag, load_env, ragas_llm

TESTSET_PATH = ARTIFACTS_DIR / "testset.json"


def load_cases_local() -> list:
    if not TESTSET_PATH.exists():
        print(f"No {TESTSET_PATH}. Generate a testset first (generate_dataset.py).")
        sys.exit(1)
    records = json.loads(TESTSET_PATH.read_text())
    return [{"question": r["user_input"], "reference": r["reference"]} for r in records]


def load_cases_langsmith(dataset_name: str) -> list:
    from langsmith import Client

    client = Client()
    cases = []
    for example in client.list_examples(dataset_name=dataset_name):
        inputs = example.inputs or {}
        outputs = example.outputs or {}
        cases.append({"question": inputs.get("question", ""), "reference": outputs.get("reference", "")})
    if not cases:
        print(f"LangSmith dataset '{dataset_name}' has no examples.")
        sys.exit(1)
    return cases


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser(description="Score the GridWatch RAG pipeline with Ragas.")
    parser.add_argument("--local", action="store_true", help="use the local testset.json instead of LangSmith")
    parser.add_argument("--dataset-name", default="gridwatch-rag-eval", help="LangSmith dataset name")
    args = parser.parse_args()

    cases = load_cases_local() if args.local else load_cases_langsmith(args.dataset_name)
    print(f"Evaluating {len(cases)} cases...")

    answer = build_rag()
    samples = []
    for case in cases:
        response, contexts = answer(case["question"])
        samples.append(
            {
                "user_input": case["question"],
                "retrieved_contexts": contexts,
                "response": response,
                "reference": case["reference"],
            }
        )

    rows = asyncio.run(_score(samples))

    import pandas as pd

    df = pd.DataFrame(rows)
    ARTIFACTS_DIR.mkdir(exist_ok=True)
    df.to_csv(ARTIFACTS_DIR / "results.csv", index=False)

    metric_cols = ["faithfulness", "context_recall", "answer_accuracy"]
    means = df[metric_cols].mean(numeric_only=True)

    lines = ["| Metric | Mean score |", "| --- | --- |"]
    for metric in metric_cols:
        lines.append(f"| {metric} | {means[metric]:.3f} |")
    table = "\n".join(lines)
    (ARTIFACTS_DIR / "results.md").write_text(f"# GridWatch RAG baseline\n\n{len(cases)} cases.\n\n{table}\n")

    print("\n" + table)
    print(f"\nSaved per-case scores to {ARTIFACTS_DIR / 'results.csv'} and summary to results.md")
    return 0


async def _score(samples: list) -> list:
    """Score each sample on faithfulness, context recall, and answer accuracy.

    Uses the collections-metrics `.ascore()` API with an instructor-backed LLM so
    the judge returns structured output reliably.
    """
    from ragas.metrics.collections import AnswerAccuracy, ContextRecall, Faithfulness

    llm = ragas_llm(is_async=True)
    faithfulness = Faithfulness(llm=llm)
    context_recall = ContextRecall(llm=llm)
    answer_accuracy = AnswerAccuracy(llm=llm)

    def _val(result):
        return float(getattr(result, "value", result) or 0.0)

    rows = []
    for sample in samples:
        faith = await faithfulness.ascore(
            user_input=sample["user_input"],
            response=sample["response"],
            retrieved_contexts=sample["retrieved_contexts"],
        )
        recall = await context_recall.ascore(
            user_input=sample["user_input"],
            retrieved_contexts=sample["retrieved_contexts"],
            reference=sample["reference"],
        )
        accuracy = await answer_accuracy.ascore(
            user_input=sample["user_input"],
            response=sample["response"],
            reference=sample["reference"],
        )
        rows.append(
            {
                "user_input": sample["user_input"],
                "faithfulness": _val(faith),
                "context_recall": _val(recall),
                "answer_accuracy": _val(accuracy),
            }
        )
    return rows


if __name__ == "__main__":
    sys.exit(main())
