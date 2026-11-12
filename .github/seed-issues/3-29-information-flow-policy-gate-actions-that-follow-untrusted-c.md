---
title: Information-flow policy: gate actions that follow untrusted content
labels: help wanted,security,level-3-advanced
---
A phrase filter cannot stop prompt injection. A structural control can: label content that came from outside (web pages, emails, tool output) as untrusted, and require review or deny for sensitive actions taken in a session that has read it.

**What to do** prototype session taint tracking in the engine (taint set per session ID, set by an `untrusted_input` flag on authorize or `/v1/scan/output`, consulted by policy) and a policy syntax such as `when: session.tainted and action.risk == "high"`. Write up the threat model. This is research-grade; propose a design in the thread first.
