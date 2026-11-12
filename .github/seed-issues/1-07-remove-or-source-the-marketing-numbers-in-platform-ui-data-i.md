---
title: Remove or source the marketing numbers in `platform/ui/data/index.ts`
labels: good first issue,documentation,level-1-first-timer
---
The landing page shows "SOC 2 Compliant", "28k+ GitHub Stars", "<50ms P95", "100% Audit Coverage" and three named testimonials. None has a source in the repository, and the audit measured p95 of about 80 ms at 16 concurrent callers with 76 percent of audit events dropped under load.

**What to do**
- Replace each with something true and checkable (the live GitHub star count, a measured latency with a link to the benchmark, or remove the tile).
- Remove testimonials that are not from real, consenting users.

Audit reference: claims table, section 3.
