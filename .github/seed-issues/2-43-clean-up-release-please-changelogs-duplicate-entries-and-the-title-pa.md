---
title: Clean up release-please changelogs: duplicate entries and the title-pattern warning
labels: help wanted,enhancement,level-2-intermediate
---
The first release PR (#9) generated changelogs listing many commits twice and back-filled history from before the manifest existed, and every run logs `pullRequestTitlePattern miss the part of '${scope}' / '${component}' / '${version}'`.

**What to do**
- Look at `.github/release-please-config.json` and the first generated `CHANGELOG.md` entries; find why commits appear twice (for example both a branch commit and its merge commit) and how to avoid it.
- Make the title pattern include the parts the warning names, without breaking release-please's ability to find existing release PRs (check that against a dry run or a test repo).
- Describe how you verified the change.

**Done when** a release PR's changelog lists each change once and the warnings are gone.
