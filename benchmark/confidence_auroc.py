"""
Confidence-validation benchmark (evidence layer).

Question: does model confidence predict whether an answer was correct?
Method  : reuse published per-question outputs from Plaut et al., TMLR 2025
          ("Probabilities of Chat LLMs Are Miscalibrated but Still Predict
          Correctness on Multiple-Choice Q&A"). No model inference, no API key.
          For each real answer we take confidence = max softmax probability and
          whether it was Correct, then compute the AUROC of confidence -> correct.

Usage:
    pip install numpy
    python confidence_auroc.py                 # clones dataset once, prints table
    python confidence_auroc.py /path/to/files   # use already-downloaded results dir

Only depends on numpy: AUROC is computed with the rank (Mann-Whitney) formula,
so scikit-learn is not required.
"""
import glob
import os
import re
import subprocess
import sys
from collections import defaultdict

import numpy as np

REPO_URL = "https://github.com/bplaut/softmax-probs-predict-llm-correctness.git"
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".dataset")
# Chat models, single-pass (not few-shot), softmax probs, first prompt.
GLOB = "results/chat_results/*c=prob*first_prompt*"


def ensure_dataset(dest):
    """Blobless sparse clone of just the chat-results probability files."""
    results_dir = os.path.join(dest, "results", "chat_results")
    if glob.glob(os.path.join(dest, GLOB)):
        return results_dir
    print(f"downloading dataset into {dest} (one-time, a few minutes) ...", file=sys.stderr)
    if not os.path.isdir(os.path.join(dest, ".git")):
        subprocess.run(
            ["git", "clone", "--depth", "1", "--filter=blob:none", "--sparse", REPO_URL, dest],
            check=True,
        )
    subprocess.run(["git", "-C", dest, "sparse-checkout", "set", "--no-cone", GLOB], check=True)
    subprocess.run(["git", "-C", dest, "checkout", "HEAD", "--", "results/chat_results"], check=True)
    return results_dir


def auroc(conf, y):
    """AUROC via the rank formula: P(confidence of a correct > that of a wrong)."""
    conf = np.asarray(conf, dtype=float)
    y = np.asarray(y, dtype=int)
    n_pos = int(y.sum())
    n_neg = len(y) - n_pos
    if n_pos == 0 or n_neg == 0:
        return float("nan")
    # Tie-averaged ranks.
    order = np.argsort(conf, kind="mergesort")
    cs = conf[order]
    ranks = np.empty(len(conf))
    i = 0
    while i < len(cs):
        j = i
        while j < len(cs) and cs[j] == cs[i]:
            j += 1
        ranks[order[i:j]] = (i + j + 1) / 2.0
        i = j
    rank_pos_sum = ranks[y == 1].sum()
    return (rank_pos_sum - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg)


def parse_file(path):
    """Yield (confidence, correct) for each answer line in a result file."""
    with open(path, encoding="utf-8", errors="replace") as fh:
        next(fh, None)  # header
        for line in fh:
            parts = line.strip().split(" ", 1)
            if len(parts) != 2 or parts[0] not in ("Correct", "Wrong"):
                continue
            try:
                probs = [float(x) for x in parts[1].split(",") if x]
            except ValueError:
                continue
            if probs:
                yield max(probs), int(parts[0] == "Correct")


def main():
    results_dir = sys.argv[1] if len(sys.argv) > 1 else ensure_dataset(CACHE_DIR)
    files = sorted(
        p for p in glob.glob(os.path.join(results_dir, "*.txt"))
        if "c=prob" in p and "first_prompt" in p and "few_shot" not in p
    )
    if not files:
        sys.exit(f"no result files found in {results_dir}")

    by_model = defaultdict(lambda: ([], []))
    by_dataset = defaultdict(lambda: ([], []))
    all_conf, all_y = [], []
    for path in files:
        name = os.path.basename(path)
        m = re.search(r"m=([^_]+)", name)
        d = re.search(r"d=([^_]+)", name)
        if not (m and d):
            continue
        for conf, y in parse_file(path):
            by_model[m.group(1)][0].append(conf)
            by_model[m.group(1)][1].append(y)
            by_dataset[d.group(1)][0].append(conf)
            by_dataset[d.group(1)][1].append(y)
            all_conf.append(conf)
            all_y.append(y)

    print(f"\n{'model':<18}{'n':>9}{'acc':>8}{'AUROC':>8}")
    for model in sorted(by_model, key=lambda k: -np.nan_to_num(auroc(*by_model[k]))):
        c, y = by_model[model]
        print(f"{model:<18}{len(y):>9}{np.mean(y):>8.3f}{auroc(c, y):>8.3f}")

    print(f"\n{'dataset':<18}{'n':>9}{'acc':>8}{'AUROC':>8}")
    for ds in sorted(by_dataset):
        c, y = by_dataset[ds]
        print(f"{ds:<18}{len(y):>9}{np.mean(y):>8.3f}{auroc(c, y):>8.3f}")

    print(f"\nOVERALL  n={len(all_y)}  acc={np.mean(all_y):.3f}  AUROC={auroc(all_conf, all_y):.3f}")


if __name__ == "__main__":
    main()
