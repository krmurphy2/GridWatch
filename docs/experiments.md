# Experiments

## Purpose

Track model, retrieval, tool, and evaluation experiments for the GridWatch home
network security assistant.

## Experiment Template

### Experiment: TBD

- **Date:** TBD
- **Hypothesis:** TBD
- **Change:** TBD
- **Dataset:** TBD
- **Model/configuration:** TBD
- **Cost impact:** TBD
- **Latency impact:** TBD
- **Metrics:** TBD
- **Result:** TBD
- **Decision:** TBD
- **Follow-up:** TBD

## Planned Experiments

### Baseline Dense Retrieval

- **Hypothesis:** A small trusted corpus with dense retrieval can answer common
  home network hardening questions faithfully.
- **Metrics:** Faithfulness, answer relevancy, context precision, context recall.
- **Status:** Planned.

### Hybrid Retrieval

- **Hypothesis:** Hybrid keyword plus dense retrieval will improve queries with
  exact identifiers such as CVE IDs, router model names, protocols, and ports.
- **Metrics:** Context precision, context recall, answer relevancy, latency.
- **Status:** Planned for Task 6.

### Scan Safety Guardrails

- **Hypothesis:** Explicit target validation plus approval gates can prevent the
  agent from initiating arbitrary internet scans.
- **Metrics:** Safety compliance and refusal quality on adversarial test cases.
- **Status:** Planned.
