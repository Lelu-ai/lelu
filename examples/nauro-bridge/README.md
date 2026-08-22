# Lelu + Nauro: authorization and memory, wired together

A draft of one concrete integration point between [Lelu](https://github.com/lelu-ai/lelu) and
[Nauro](https://github.com/nauro-ai/nauro), grounded in both projects' real APIs — not a mockup.

**Design discussion**: [nauro-ai/nauro#468](https://github.com/Nauro-AI/nauro/discussions/468) —
read that before this file. It corrects an earlier version of this example that auto-promoted a
Lelu resolution note straight into a Nauro decision. That was wrong: a Lelu approval resolves one
runtime action; it is not Nauro judgment, and whether any of the reasoning behind it belongs in
Nauro's project record is a separate, human-gated call.

## The idea

Lelu decides whether an agent's action runs. When a decision is uncertain enough to need a person,
it pauses as a `human_review` item and a human resolves it with `approve_review()` /
`deny_review()`, optionally attaching a `note`.

That note is source material, not a proposal. It may contain reasoning worth carrying forward as
durable project judgment (Nauro), reasoning that's specific to this one case and shouldn't (most
of them), or a mix of both that a human needs to untangle before anything gets recorded.

## What this bridge actually does — and doesn't

`bridge.py` covers only the Lelu side: trigger a `human_review`, resolve it, and hand off a
**minimal source packet** — `review_id` plus non-sensitive metadata, not the note itself. It stops
there.

```
Lelu ReviewItem (resolved)
───────────────────────────
review_id           ──────▶  the pointer — an agent session fetches full detail
action, status,               via get_review(review_id) only if it decides
resolved_by/_at               there's something here worth carrying forward
```

It does **not** call `propose_decision`. That's deliberate, per the discussion above: an MCP-
connected agent session (Claude Code, Codex, etc.) owns the judgment side — check
`check_decision` against related existing decisions, draft the exact proposal, get a human to
approve *that exact draft*, and only then call `propose_decision`. Scripting past that gate would
recreate the automatic-promotion bug this design fixes.

## Try it

Requires a running Lelu engine (`npx -y lelu-mcp start`, or point `LELU_BASE_URL` / `LELU_API_KEY`
at one).

```bash
pip install "../../sdk/python[all]"
python bridge.py
```

Prints the resolved `review_id` and the source packet — verified end-to-end against a live local
engine, not just import-checked.

## Status

Still a draft, now aligned with Thomas Thomsen's design in nauro-ai/nauro#468. Open questions
tracked there: what the smallest safe source packet looks like in practice, whether a
lighter-weight "report" lane (non-ratified, for outcomes worth keeping without becoming project
judgment) is worth building once the judgment path itself works, and what a runnable end-to-end
test — Lelu fixture + resolution on this side, Nauro's judgment flow on the other — should look
like.
