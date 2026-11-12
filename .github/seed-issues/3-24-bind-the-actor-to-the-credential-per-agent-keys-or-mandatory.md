---
title: Bind the actor to the credential: per-agent keys or mandatory workload tokens
labels: help wanted,security,level-3-advanced
---
The `actor` in a request is a string the caller chose. Policy keyed on it protects nothing against a caller that lies.

**What to do**
- Add an engine flag that rejects requests whose actor is not verified (`actor_verified:false`).
- Let the registry map a registered agent (UUID) to a policy scope name, so a verified agent resolves to a real `agent_scope` instead of "unknown agent scope <uuid>".
- Check the verified agent's tenant equals the request tenant.

Audit reference: POL-02, V7, V-6.
