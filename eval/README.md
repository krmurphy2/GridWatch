# GridWatch RAG Evaluation Harness

Offline evaluation for the RAG pipeline (Certification Task 5). It is a **separate
uv project** from `agent/` on purpose: Ragas pins conflict with the agent's
LangChain 1.x dependencies, so keeping it isolated protects the deployed agent.

It reuses the **same corpus** (`agent/corpus/*.md`) and the same chunking,
embedding, and retrieval settings as production, so the scores reflect the shipped
pipeline.

## Setup

```bash
cd eval
uv sync
cp .env.example .env   # then fill in OPENAI_API_KEY (+ LANGSMITH_API_KEY for push/pull)
```

## 1. Generate a synthetic testset (with human review)

```bash
uv run python generate_dataset.py --size 12      # -> artifacts/testset.json
# review/edit artifacts/testset.json by hand, then:
uv run python generate_dataset.py --push --dataset-name gridwatch-rag-eval
```

Generation and upload are deliberately separate so synthetic questions are
reviewed before they become the dataset.

## 2. Run the evaluation

```bash
uv run python run_eval.py                    # pulls questions from the LangSmith dataset
uv run python run_eval.py --local            # or score the local testset.json
```

Outputs a table of **Faithfulness**, **LLM Context Recall**, and **Factual
Correctness**, and writes per-case scores to `artifacts/results.csv` and a summary
to `artifacts/results.md`. This baseline is what Task 6 compares an advanced
retriever against.

## Notes

- Ragas metrics and synthetic generation make many LLM calls — keep `--size` small
  to bound cost.
- `artifacts/`, `.env`, and `.venv/` are gitignored.
