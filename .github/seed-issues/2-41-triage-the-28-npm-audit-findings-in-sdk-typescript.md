---
title: Triage the 28 `npm audit` findings in `sdk/typescript`
labels: help wanted,security,level-2-intermediate
---
`npm ci` in `sdk/typescript` reports 28 vulnerabilities (1 low, 10 moderate, 12 high, 5 critical). Installing the published package reports 0, because the shipped dependencies are only `zod` and `@opentelemetry/api`; the findings look like dev dependencies (test and build tooling), but this has not been confirmed.

**What to do**
- Run `npm audit --omit=dev` to show what users actually get, and `npm audit` for the rest.
- Update or replace the dev dependencies that can be updated without breaking the build; list the rest with a reason.
- Optionally add `npm audit --omit=dev --audit-level=high` as a CI step so the shipped set stays clean.

**Done when** the shipped dependencies are shown to be clean and the remaining dev-only findings are either fixed or explained in the PR.
