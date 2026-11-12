---
title: Print the generated reviewer key in `lelu-mcp start`
labels: good first issue,enhancement,level-1-first-timer
---
`lelu-mcp start` creates an admin API key but no reviewer key, so the human running the agent has no safe way to approve reviews.

**What to do** (in `sdk/mcp/src/local-engine.ts`) generate a random reviewer key, pass it to the child engine as `LELU_REVIEWER_KEYS=human:<key>`, store it in a file only the user is told about, and print the path once. Do **not** include it in any tool output the model can read.

Audit reference: M4, V29.
