"""Run the GridWatch RAG pipeline over the eval testset and score it with Ragas.

  uv run python run_eval.py                 # LangSmith experiment on the dataset
  uv run python run_eval.py --local         # offline: score local testset.json

Default mode runs a LangSmith experiment (langsmith.aevaluate) against the
dataset created by generate_dataset.py, so per-example and aggregate scores show
up in the LangSmith UI under the dataset's Experiments tab. --local scores the
local testset.json instead and writes a table to artifacts/ (no LangSmith).

Both score the same three Ragas metrics: Faithfulness, Context Recall, Answer
Accuracy. This baseline is what Task 6 compares an advanced retriever against.
"""

import argparse
import asyncio
import json
import sys

from eval_common import ARTIFACTS_DIR, build_rag, load_env, ragas_llm

TESTSET_PATH = ARTIFACTS_DIR / "testset.json"


def _val(result) -> float:
    return float(getattr(result, "value", result) or 0.0)


def _metrics(llm):
    from ragas.metrics.collections import AnswerAccuracy, ContextRecall, Faithfulness

    return Faithfulness(llm=llm), ContextRecall(llm=llm), AnswerAccuracy(llm=llm)


# --- LangSmith experiment mode (default) -----------------------------------


async def run_langsmith(dataset_name: str) -> None:
    from langsmith import aevaluate

    answer = build_rag()
    faithfulness, context_recall, answer_accuracy = _metrics(ragas_llm(is_async=True))

    async def target(inputs: dict) -> dict:
        response, contexts = answer(inputs["question"])
        return {"answer": response, "contexts": contexts}

    async def faithfulness_eval(run, example):
        out = run.outputs or {}
        score = await faithfulness.ascore(
            user_input=example.inputs["question"],
            response=out.get("answer", ""),
            retrieved_contexts=out.get("contexts", []),
        )
        return {"key": "faithfulness", "score": _val(score)}

    async def context_recall_eval(run, example):
        out = run.outputs or {}
        score = await context_recall.ascore(
            user_input=example.inputs["question"],
            retrieved_contexts=out.get("contexts", []),
            reference=(example.outputs or {}).get("reference", ""),
        )
        return {"key": "context_recall", "score": _val(score)}

    async def answer_accuracy_eval(run, example):
        out = run.outputs or {}
        score = await answer_accuracy.ascore(
            user_input=example.inputs["question"],
            response=out.get("answer", ""),
            reference=(example.outputs or {}).get("reference", ""),
        )
        return {"key": "answer_accuracy", "score": _val(score)}

    results = await aevaluate(
        target,
        data=dataset_name,
        evaluators=[faithfulness_eval, context_recall_eval, answer_accuracy_eval],
        experiment_prefix="gridwatch-rag-baseline",
        max_concurrency=2,
    )
    name = getattr(results, "experiment_name", None)
    print(f"\nLangSmith experiment complete{f': {name}' if name else ''}.")
    print(f"View scores under dataset '{dataset_name}' -> Experiments in LangSmith.")


# --- Local offline mode (--local) ------------------------------------------


def load_cases_local() -> list:
    if not TESTSET_PATH.exists():
        print(f"No {TESTSET_PATH}. Generate a testset first (generate_dataset.py).")
        sys.exit(1)
    records = json.loads(TESTSET_PATH.read_text())
    return [{"question": r["user_input"], "reference": r["reference"]} for r in records]


async def score_local(samples: list) -> list:
    faithfulness, context_recall, answer_accuracy = _metrics(ragas_llm(is_async=True))
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


def run_local() -> None:
    cases = load_cases_local()
    print(f"Evaluating {len(cases)} cases locally...")
    answer = build_rag()
    samples = [
        {"user_input": c["question"], "retrieved_contexts": ctx, "response": resp, "reference": c["reference"]}
        for c in cases
        for resp, ctx in [answer(c["question"])]
    ]

    rows = asyncio.run(score_local(samples))

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


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser(description="Score the GridWatch RAG pipeline with Ragas.")
    parser.add_argument("--local", action="store_true", help="score local testset.json instead of a LangSmith experiment")
    parser.add_argument("--dataset-name", default="gridwatch-rag-eval", help="LangSmith dataset name")
    args = parser.parse_args()

    if args.local:
        run_local()
    else:
        asyncio.run(run_langsmith(args.dataset_name))
    return 0


if __name__ == "__main__":
    sys.exit(main())
