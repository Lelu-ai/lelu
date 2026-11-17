---
title: Privacy page: do not promise 30-day account deletion until there is a self-serve route
labels: good first issue,documentation,level-1-first-timer
---
Section 7 of `platform/ui/app/privacy/page.tsx` says Lelu "permanently purges all Customer policies, API keys, and stored telemetry within 30 days" of a deletion request, and the rights list in Section 8 lists deletion as a normal feature. Section 8 now says erasure is handled by hand through `privacy@lelu-ai.com`; the dashboard has no delete-account route.

**What to do**
- Reword Section 7 and the Section 8 rights list so they match: deletion is by request, handled manually, with no fixed time promised unless the maintainers confirm one.
- Keep the wording plain; do not add new legal claims.

**Done when** the two sections no longer disagree, and nothing promises more than the code or process delivers.
