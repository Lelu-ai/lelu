---
title: Stop the Vercel check from failing on every fork pull request
labels: help wanted,enhancement,level-2-intermediate
---
Every pull request from a fork shows a failing "Vercel" status: "A member of the Team first needs to authorize" the deploy. It is not a code failure, but it makes contributors' PRs look broken and hides real CI results.

**What to do**
- Find where the Vercel Git integration is configured for this repo (the project settings, or `vercel.json`/an ignore step in `platform/ui`) and skip deployments for pull requests from forks, or only run them for PRs that touch `platform/ui`.
- Add a short note to `CONTRIBUTING.md` explaining which checks to expect on a PR.

**Done when** a new fork PR that does not touch `platform/ui` shows no failing Vercel status.
