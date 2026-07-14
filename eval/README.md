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

The curated dataset (`eval/testset.json`) is **committed** so it can be reviewed;
`artifacts/` holds transient run outputs and is gitignored.

## 1. Generate a synthetic testset (with human review)

```bash
uv run python generate_dataset.py --size 15      # -> eval/testset.json (consumer-facing docs)
uv run python generate_dataset.py --size 15 --all-docs   # generate from the full corpus
# review/edit eval/testset.json by hand, then push to LangSmith:
uv run python generate_dataset.py --push                 # first upload
uv run python generate_dataset.py --push --replace       # re-upload: overwrite the existing dataset
```

Ragas generates with two personas (everyday + tech-curious home user) and a
single-hop-heavy query distribution. Generation and upload are deliberately
separate so synthetic questions are human-reviewed before they become the dataset.

`--push` creates the LangSmith dataset (`--dataset-name`, default
`gridwatch-rag-eval`); it errors if that name already exists. Re-run with
`--replace` to delete and recreate it so it matches the current `testset.json`
(no duplicate examples) — do this **before** running experiments on the dataset.

## 2. Run the evaluation

```bash
uv run python run_eval.py                    # LangSmith experiment on the dataset
uv run python run_eval.py --local            # offline: score local testset.json (hybrid)
uv run python run_eval.py --local --mode dense   # offline, dense-only
uv run python run_eval.py --compare          # dense vs hybrid table (Task 6)
uv run python run_eval.py --compare-prompt   # baseline vs grounded answer prompt (Task 6)
```

All score **Faithfulness**, **Context Recall**, and **Answer Accuracy**.

- **Default (LangSmith):** runs a `langsmith.aevaluate` experiment against the
  dataset, so per-example and aggregate scores appear in the **LangSmith UI** under
  the dataset's *Experiments* tab. Requires the dataset to exist (step 1 `--push`)
  and `LANGSMITH_API_KEY`.
- **`--local`:** scores `artifacts/testset.json` and writes `artifacts/results.csv`
  + `artifacts/results.md`. No LangSmith needed.

This baseline is what Task 6 compares an advanced retriever against.

## Notes

- Ragas metrics and synthetic generation make many LLM calls — keep `--size` small
  to bound cost.
- `artifacts/`, `.env`, and `.venv/` are gitignored.
