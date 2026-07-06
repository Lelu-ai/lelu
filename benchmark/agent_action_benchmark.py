"""
Lelu confidence-validation benchmark for AGENT ACTIONS.

Question: does LOW model confidence predict WRONG/UNSAFE agent actions?
Output : AUROC  -> how well confidence separates correct from wrong actions
         + confident_wrong_rate -> the blind-spot size (wrong actions that looked confident)

See it work now:   python agent_action_benchmark.py --demo
Run for real   :   implement load_dataset() + sample_action_fn(), then:
                   python agent_action_benchmark.py --dataset bfcl --n-samples 8
"""
import argparse
import json
from collections import Counter

import numpy as np
from sklearn.metrics import roc_auc_score


# ---------- helpers ----------
def normalize(action):
    """Canonicalize a tool call (name + sorted args) so equal calls compare equal."""
    return json.dumps(action, sort_keys=True) if isinstance(action, dict) else str(action)


# ---------- 1. CONFIDENCE SIGNALS ----------
def confidence_self_consistency(sample_action_fn, prompt, n=8):
    """Sample the action n times; confidence = fraction agreeing with the most common one."""
    actions = [normalize(sample_action_fn(prompt, temperature=0.7)) for _ in range(n)]
    top, top_count = Counter(actions).most_common(1)[0]
    return (json.loads(top) if top.startswith("{") else top), top_count / n


def confidence_logprob(token_logprobs):
    """Confidence = mean token probability of the emitted action tokens."""
    return float(np.mean([np.exp(lp) for lp in token_logprobs]))


# ---------- 2. LABELING ----------
def is_wrong(predicted_action, gold_action):
    """Deterministic label when gold exists (e.g. BFCL). 1 = wrong, 0 = correct."""
    return int(normalize(predicted_action) != normalize(gold_action))


# ---------- 3. METRICS ----------
def evaluate(confidences, wrong_labels, threshold=0.6):
    c = np.asarray(confidences, dtype=float)
    y = np.asarray(wrong_labels, dtype=int)          # 1 = wrong
    risk = 1 - c                                      # low confidence = high risk
    auroc = roc_auc_score(y, risk) if len(set(y)) > 1 else float("nan")
    wrong = y == 1
    confident_wrong = float(np.mean(c[wrong] >= threshold)) if wrong.any() else 0.0
    caught = float(np.mean((y == 1) & (c < threshold)))       # wrong AND stopped (good)
    false_stop = float(np.mean((y == 0) & (c < threshold)))   # correct but stopped (cost)
    return {
        "auroc": round(auroc, 3),
        "confident_wrong_rate": round(confident_wrong, 3),
        "caught_rate": round(caught, 3),
        "false_stop_rate": round(false_stop, 3),
        "n": int(len(y)), "wrong_n": int(wrong.sum()),
    }


def verdict(auroc):
    if auroc != auroc:
        return "INCONCLUSIVE - need both correct and wrong actions in the set"
    if auroc >= 0.75:
        return "STRONG - confidence is a real signal. Build it."
    if auroc >= 0.65:
        return "PROMISING - worth the calibrated/conformal upgrade."
    if auroc >= 0.55:
        return "WEAK - confidence alone isn't enough; layer it or rethink."
    return "DEAD - confidence does not predict mistakes here. Don't build on it."


# ---------- 4. DEMO (runnable now, synthetic data) ----------
def demo():
    rng = np.random.default_rng(0)

    def make(world, n=400, wrong_rate=0.3):
        conf, lab = [], []
        for _ in range(n):
            wrong = rng.random() < wrong_rate
            if world == "good":
                c = rng.beta(2, 6) if wrong else rng.beta(6, 2)   # wrong->low, correct->high
            else:
                c = rng.beta(4, 4)                                # confidence unrelated
            conf.append(float(np.clip(c, 0, 1)))
            lab.append(int(wrong))
        return conf, lab

    for world, name in [("good", "GOOD world  (confidence predicts mistakes)"),
                        ("bad", "NOISE world (confidence is unrelated)")]:
        conf, lab = make(world)
        m = evaluate(conf, lab)
        print(f"\n{name}")
        print(f"  {m}")
        print(f"  -> {verdict(m['auroc'])}")


# ---------- 5. REAL RUN (scaffold) ----------
def load_dataset(name):
    # TODO: return list of {"prompt": ..., "gold_action": {...}}
    # BFCL: github.com/ShishirPatil/gorilla (berkeley-function-call-leaderboard) - deterministic gold
    # tau-bench: github.com/sierra-research/tau-bench - realistic, multi-turn
    raise NotImplementedError("Implement load_dataset() for your chosen benchmark.")


def sample_action_fn(prompt, temperature=0.7):
    # TODO: call YOUR model, return the proposed tool call as a dict {"name":..., "args":{...}}
    raise NotImplementedError("Wire this to your model provider (OpenAI/Anthropic/etc.).")


def run_real(args):
    tasks = load_dataset(args.dataset)
    confidences, wrong = [], []
    for t in tasks:
        action, conf = confidence_self_consistency(sample_action_fn, t["prompt"], n=args.n_samples)
        confidences.append(conf)
        wrong.append(is_wrong(action, t["gold_action"]))
    m = evaluate(confidences, wrong, threshold=args.threshold)
    print(json.dumps(m, indent=2))
    print(verdict(m["auroc"]))
    with open("RESULTS.json", "w") as f:
        json.dump({"metrics": m, "verdict": verdict(m["auroc"])}, f, indent=2)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--demo", action="store_true")
    p.add_argument("--dataset", default="bfcl")
    p.add_argument("--n-samples", type=int, default=8)
    p.add_argument("--threshold", type=float, default=0.6)
    a = p.parse_args()
    demo() if a.demo else run_real(a)
