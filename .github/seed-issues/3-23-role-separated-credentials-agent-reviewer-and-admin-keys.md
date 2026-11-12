---
title: Role-separated credentials: agent, reviewer and admin keys
labels: help wanted,security,level-3-advanced
---
In the default mode one static key authorizes, rewrites policy, resolves reviews, touches the vault and registers agents. An agent holding it can approve its own work and replace its own policy (audit AUTH-07 and HITL-01, both critical).

**What to do** (`engine/internal/server/`)
- Introduce key classes: `agent` (authorize, wait, redeem, get its own review), `reviewer` (resolve), `admin` (policy, vault, registry, analytics, mint).
- Generate all three on first boot when none is configured; refuse to start in production without them.
- Return 403 when a key class calls a route outside its class. Table-test every route.
- Update `lelu-mcp` and all SDK quickstarts.

This is the single most valuable change in the project. Comment here before starting so we can agree the design.
