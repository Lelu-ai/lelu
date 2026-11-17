---
title: Reword "SOC 2-ready immutable event trail" on the audit page
labels: good first issue,documentation,level-1-first-timer
---
`platform/ui/app/audit/page.tsx` says "SOC 2-ready immutable event trail". Lelu has not been through a SOC 2 audit, and the audit log is hash-chained and signed (so edits are detectable) but not strictly immutable: events can also be dropped when the default audit writer's buffer is full.

**What to do**
- Replace the sentence with something accurate, for example "Hash-chained, signed event trail" (see `docs/` for what the receipts guarantee).
- Search `platform/ui` for any other "immutable" or "SOC 2" claims and list them in the PR.

**Done when** the page makes no compliance or immutability claim the code does not support.
