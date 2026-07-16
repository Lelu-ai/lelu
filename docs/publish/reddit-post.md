<!--
Reddit drafts — value-first, NOT promotional.
Rules baked in: (1) disclose you're the author, (2) lead with the problem/lesson,
(3) the repo is one line at the end, (4) end with a real question.
Don't paste the same text into 5 subs at once — pick one, engage in comments,
wait, then adapt for the next. Read each sub's self-promo rule first.
-->

# Draft A — r/LLMDevs or r/AI_Agents (the confidence angle)

**Title:** An AI agent can fake its own confidence score — which breaks most "only act when confident" guardrails

**Body:**

I kept seeing the same pattern in agent code: "only run the tool if confidence > 0.8,"
where `confidence` is a number the LLM reports about itself. The problem is that a
prompt-injected or confused agent will happily report `0.99` while doing something
dumb. Self-reported confidence is exactly the thing you can't trust when you most
need to.

A few things I ended up learning the hard way while building a check for this:

- **Derive confidence from the provider's token logprobs, not the model's
  self-assessment.** `mean(exp(logprob))` over the response tokens is a rough but
  real signal that comes from the actual output distribution. The agent can't
  fabricate it.
- **Absence of a signal has to fail closed.** My first version defaulted missing
  confidence to `1.0` — which silently turns "I don't know" into "I'm certain,"
  the most dangerous reading. Now a missing signal routes to deny/human-review by
  policy.
- **Not every provider exposes logprobs.** OpenAI does; Anthropic doesn't; on
  Bedrock it's model-dependent (Cohere yes, Claude no). For the no-logprob case
  you need a different strategy (self-consistency sampling) or you fail closed.
- **Check for prompt injection *before* the confidence/policy logic**, on the raw
  action + args — otherwise a clever payload influences the very thing deciding
  whether to allow it.

I wrote this up as an open-source engine (MIT) — happy to share the link if it's
useful, it's in my profile / I'll drop it in a comment to keep this from looking
like an ad. Mostly I'm curious:

**For those running agents in production — how are you deciding when an agent is
"sure enough" to act autonomously? Logprobs, a judge model, self-consistency,
something else?**

---

# Draft B — r/netsec or r/devops (the authorization angle)

**Title:** Traditional authz answers "who can do what" — but an AI agent is *authorized* and still gets manipulated. How are people handling this?

**Body:**

Standard authorization (RBAC, OPA, etc.) decides whether an identity *may* perform
an action. That's necessary but it assumes the caller's intent is sound. With AI
agents that assumption breaks: the agent is legitimately authorized, but a prompt
injection or a low-confidence hallucination turns it into a confused deputy that
calls your tools anyway.

I've been working on a runtime check that runs *after* "is this allowed" and asks
"is this allowed action safe to run *right now*" — layering a prompt-injection
filter, a confidence gate (derived from model logprobs, not self-reported), and a
most-restrictive merge that can downgrade to read-only or hold for human review.

Two design choices I'd push on if I were reviewing it:

- **Fail closed everywhere.** Detector errors, missing confidence, unknown
  agents → deny or escalate, never default-allow. Easy to say, easy to get wrong
  (I shipped a fail-open default and had to fix it).
- **Tamper-evident audit.** Every decision logs input/output/policy hashes so you
  can later prove what was asked and decided — useful for OWASP-LLM / NIST AI RMF.

It's open source (MIT); I'll put the link in a comment rather than the post body.
Genuinely interested in critique:

**Has anyone deployed something like this in front of agent tool calls? What
broke, and where did the false-positives hurt most?**

---

## Posting etiquette (so it doesn't get removed)
- Say you're the author somewhere visible. Hiding it is what gets posts nuked.
- Put the repo link in a **comment**, not the title/first line.
- One sub at a time; reply to every comment for the first few hours.
- Skip r/MachineLearning unless you tag it **[P]** and lead with substance.
- Don't reuse the exact same text across subs — Reddit's spam filter flags it.
