---
title: Enforcement outside the agent: an MCP proxy or Envoy external-authorization adapter
labels: help wanted,security,level-3-advanced
---
Lelu returns advice; the model decides whether to ask and whether to obey. The market is moving to enforcement points the model cannot skip.

**What to do** build one of: (a) an MCP proxy that fronts any MCP server, derives the action name and arguments from the real `tools/call`, asks Lelu, and forwards only on allow; or (b) a maintained Envoy/agentgateway external-authorization adapter that does not trust caller-supplied headers. Include an end-to-end test with a fake MCP server.
