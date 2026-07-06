# Paper

`main.tex` — *A Confidence You Can Measure: Validating Confidence-Gated
Authorization for AI Agents.* Writes up the confidence gate and the validation
benchmark (evidence-layer AUROC 0.709 overall, up to 0.83 on GPT-4o), with honest
limits and the agent-action milestone.

## Open in Overleaf

1. Go to <https://www.overleaf.com> → **New Project** → **Upload Project**, or
   **Blank Project** then upload `main.tex`.
2. Set the compiler to **pdfLaTeX** (Menu → Compiler). No `.bib` file is needed —
   references are inline via `thebibliography`, so it compiles on the first run.
3. Click **Recompile**.

## Compile locally

```bash
cd paper
latexmk -pdf main.tex      # or: pdflatex main.tex (run twice for references)
```

Verified with `pdflatex`/`latexmk`: 4 pages, no undefined references or
citations, no overfull boxes. Uses only standard packages bundled with Overleaf
and TeX Live (`amsmath`, `booktabs`, `graphicx`, `tikz`, `authblk`, `hyperref`).

The numbers in the results tables are reproduced by
[`../benchmark/confidence_auroc.py`](../benchmark/confidence_auroc.py); see
[`../benchmark/RESULTS.md`](../benchmark/RESULTS.md).
