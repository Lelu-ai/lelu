# Confidence Validation — Results

Reproduce with: `python confidence_auroc.py`

## Evidence layer: does confidence predict correctness? (published data)

Source: Plaut et al., TMLR 2025 — 321,105 real answers from 15 chat models across
5 multiple-choice benchmarks. Confidence = max softmax probability;
AUROC = how well that confidence separates correct answers from wrong ones.

**Overall: AUROC 0.709** (n = 321,105, accuracy 0.614).

### By model

| Model | Accuracy | AUROC (confidence → correct) |
|-------|:--------:|:----------------------------:|
| gpt-4o | 0.860 | **0.830** |
| Llama3.1-70b | 0.802 | 0.821 |
| Llama3-70b | 0.781 | 0.793 |
| gpt-3.5-turbo | 0.675 | 0.756 |
| Llama3.1-8b | 0.612 | 0.716 |
| Yi-34b | 0.688 | 0.710 |
| Llama3-8b | 0.609 | 0.707 |
| Yi-6b | 0.500 | 0.652 |
| Falcon-40b | 0.415 | 0.640 |
| Solar | 0.685 | 0.627 |
| Llama2-70b | 0.592 | 0.615 |
| Falcon-7b | 0.325 | 0.613 |
| Mistral | 0.552 | 0.590 |
| Llama2-7b | 0.436 | 0.574 |
| Mixtral | 0.680 | 0.569 |

### By task

| Task | Accuracy | AUROC |
|------|:--------:|:-----:|
| arc | 0.730 | 0.800 |
| hellaswag | 0.612 | 0.738 |
| truthfulqa | 0.524 | 0.731 |
| mmlu | 0.579 | 0.729 |
| winogrande | 0.614 | 0.601 |

## How to read it

- **The premise survives contact with real data.** Confidence predicts
  correctness well above chance everywhere (0.709 pooled), and hits ~0.82–0.83 on
  the strongest models — clearing the "strong, build it" bar (≥0.75) exactly where
  Lelu would be deployed.
- **It is conditional.** Weak models (Mixtral 0.57, Mistral 0.59) and hard tasks
  (winogrande 0.60) drop toward "not useful." Lelu should target capable models
  and report reliability per model rather than assume it works everywhere.
- **The strongest, most aligned models had the best AUROC** — evidence against the
  simple "RLHF ruins confidence" worry for the *ranking* a gate actually needs.

## Honest limits (what this does NOT prove)

1. **Cheapest signal.** Max softmax is the weak baseline; self-consistency and
   semantic entropy should beat these numbers — so 0.71–0.83 is roughly the floor.
2. **Q&A, not agent tool-calls.** Confidence over 4 clean options is tidier than
   confidence over generated tool arguments. This is an optimistic proxy.
3. **"Correct" is not "safe."** Lelu gates unsafe actions; correctness is a proxy
   for that, not the same thing.

Limits 2 and 3 are exactly what `agent_action_benchmark.py` (BFCL / τ-bench) is
built to close. That run is the next milestone.
