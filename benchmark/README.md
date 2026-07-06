# Confidence Validation Benchmark

Lelu gates agent actions on model **confidence**. That gate is only worth
anything if one sentence is true:

> When the model is less confident, the action is more likely to be wrong or unsafe.

This directory measures whether that sentence holds — honestly, on real data,
publishing the number and the failure cases. **A confidence gate you can't
measure is theater.**

The metric is **AUROC**: a single number from 0.5 to 1.0 for how well confidence
separates correct actions from wrong ones.

| AUROC | Meaning |
|-------|---------|
| ~0.50 | Dead — confidence tells you nothing. Don't build on it. |
| 0.55–0.65 | Weak — confidence alone isn't enough; layer it or rethink. |
| 0.65–0.75 | Promising — worth the calibrated/conformal upgrade. |
| ≥ 0.75 | Strong — confidence is a real signal. Build it. |

---

## 1. `confidence_auroc.py` — the evidence we have today

Reproduces the core-premise check on **published model outputs** from Plaut et
al., *"Probabilities of Chat LLMs Are Miscalibrated but Still Predict Correctness
on Multiple-Choice Q&A"* (TMLR 2025). No API key, no model inference — it reuses
321,105 real answers from 15 chat models across 5 Q&A benchmarks and computes the
AUROC of `max softmax prob → was the answer correct`.

```bash
pip install numpy
python confidence_auroc.py          # clones the dataset (~once) and prints the table
```

Latest reproduced result is in [`RESULTS.md`](./RESULTS.md): **overall AUROC
0.709, up to 0.83 on the strongest models (gpt-4o).** That is independent
evidence — not our opinion — that the premise survives contact with real data,
and is strongest exactly on the capable models Lelu targets.

**What this proves:** model confidence is a real, useful correctness signal on
capable models, even using the weakest possible measure of it (max softmax).

**What it does NOT prove:** this is multiple-choice Q&A, not agent tool-calls,
and "correct" is not "safe." That gap is what script 2 exists to close.

## 2. `agent_action_benchmark.py` — the milestone we still owe

The version that measures Lelu's *actual* setting: does confidence predict
**wrong/unsafe agent tool-calls**? It ships a runnable `--demo` (synthetic
good-world vs noise-world) so you can see the machinery, plus a real-run scaffold
with two functions to fill in.

```bash
pip install numpy scikit-learn
python agent_action_benchmark.py --demo        # see a 0.98 vs a 0.52 world
python agent_action_benchmark.py --dataset bfcl --n-samples 8   # real run (after wiring)
```

To turn the demo into a real result, implement the two functions at the bottom:

- `load_dataset()` — return tasks as `{"prompt": ..., "gold_action": {...}}`.
  Start with **BFCL** (Berkeley Function-Calling Leaderboard) — every example
  ships a gold tool call, so labeling is deterministic (`wrong = predicted != gold`).
  Graduate to **τ-bench** for realistic multi-turn unsafe-action cases.
- `sample_action_fn(prompt, temperature)` — call your model, return the proposed
  tool call as a dict. Everything else (self-consistency sampling, AUROC,
  verdict, `RESULTS.json`) already works.

Run it on 2–3 models (a small open one and a frontier one). If confidence
predicts mistakes on some models but not others, that itself is a publishable
finding. If the agent-action AUROC lands near the QA numbers above, Lelu's
confidence thesis is proven on the thing it actually does.
