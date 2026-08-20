# Lelu + Nauro: authorization and memory, wired together

A rough draft of one concrete integration point between [Lelu](https://github.com/lelu-ai/lelu)
and [Nauro](https://github.com/nauro-ai/nauro), grounded in both projects' real APIs — not a
mockup.

## The idea

Lelu decides whether an agent's action runs. When a decision is uncertain enough to need a
person, it pauses as a `human_review` item and a human resolves it with `approve_review()` /
`deny_review()`, optionally attaching a `note` explaining why.

Today that note lives only in Lelu's audit log — a record of **what** happened, scoped to that
one action, visible mainly to whoever queries the log. Nauro exists to answer **why**, persisted
as project-level judgment that any agent, in any future session, can retrieve before it plans or
acts.

The handoff is small: when a Lelu review resolves, turn it into a Nauro decision.

```
Lelu ReviewItem (resolved)          Nauro propose_decision(...)
─────────────────────────           ──────────────────────────
id, action, resource        ──────▶ title
resolution_note              ──────▶ rationale
status (approved/denied)     ──────▶ operation="add"
confidence_score (0.0–1.0)   ──────▶ confidence ("low" | "medium" | "high")
```

Neither project needs new infrastructure for this — both already ship an MCP server, and Nauro's
`propose_decision` tool is meant to be called by exactly this kind of external actor, not just a
chat agent.

## What this gives you

Without this bridge: the next agent session that considers a similar action has no memory of the
last one — it re-asks Lelu, and a human re-explains themselves.

With it: the resolved decision and its reasoning are already in Nauro's project record. An agent
calling `nauro.get_context()` or `nauro.search_decisions()` before it plans sees *"large refunds
above $500 require finance sign-off — approved for invoice INV-1001 because it was a documented
duplicate charge"* instead of re-triggering the same review from scratch.

## Try it

Requires a running Lelu engine (`npx -y lelu-mcp start`, or point `LELU_BASE_URL` at one) and a
Nauro project (`pip install nauro && nauro init` in the directory you want decisions written to).

```bash
pip install "../../sdk/python[all]" mcp
python bridge.py
```

`bridge.py` triggers a sample `human_review` action, resolves it (standing in for the human
approval step — in a real deployment this fires from your own approval webhook/UI instead), and
writes the outcome into Nauro over MCP stdio.

## Status

This is a first draft to compare notes on, not a finished integration — in particular the
`decision_type` / `reversibility` mapping in `bridge.py` uses placeholder values pending a look at
Nauro's canonical enums in `nauro_core.constants`, and there's no handling yet for `denied`
reviews (which arguably belong in Nauro as a `rejected` entry on the relevant decision, not a new
one — open question).
