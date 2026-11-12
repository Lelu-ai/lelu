#!/usr/bin/env bash
# Create the graded contributor issues from .github/seed-issues/*.md
#
#   scripts/seed-issues.sh                 # dry run: list what would be created
#   scripts/seed-issues.sh --create        # create them with the GitHub CLI (gh)
#   scripts/seed-issues.sh --create --level 1   # only one difficulty level
#
# Each file has a front matter block (title, labels) followed by the issue body.
# Requires: gh (authenticated for the target repo). Safe to re-run only after
# deleting issues you already created; it does not de-duplicate.
set -euo pipefail
cd "$(dirname "$0")/../.github/seed-issues"

create=0; level=""
while [ $# -gt 0 ]; do
  case "$1" in
    --create) create=1 ;;
    --level) level="$2"; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

if [ "$create" = 1 ]; then
  command -v gh >/dev/null || { echo "gh (GitHub CLI) is required for --create" >&2; exit 1; }
  gh auth status >/dev/null 2>&1 || { echo "run 'gh auth login' first" >&2; exit 1; }
  for spec in "good first issue:7057ff:Good for newcomers" "help wanted:008672:Extra attention is needed" \
              "level-1-first-timer:c5def5:Small, well-scoped change" "level-2-intermediate:fbca04:Needs some familiarity with the code" \
              "level-3-advanced:d93f0b:Design work or deep changes" "security:b60205:Security hardening" \
              "tests:0e8a16:Test coverage" "documentation:0075ca:Docs" "bug:d73a4a:Something is wrong" "enhancement:a2eeef:Improvement"; do
    IFS=: read -r name color desc <<<"$spec"
    gh label create "$name" --color "$color" --description "$desc" --force >/dev/null
  done
fi

count=0
for f in ${level:+$level-}*.md; do
  [ -e "$f" ] || continue
  title=$(sed -n 's/^title: //p' "$f" | head -1)
  labels=$(sed -n 's/^labels: //p' "$f" | head -1)
  body=$(awk 'BEGIN{n=0} /^---$/{n++; next} n>=2{print}' "$f")
  count=$((count+1))
  if [ "$create" = 1 ]; then
    gh issue create --title "$title" --label "$labels" --body "$body"
  else
    printf '%2d. [%s] %s\n' "$count" "$labels" "$title"
  fi
done
echo "$count issue(s) $([ "$create" = 1 ] && echo created || echo 'would be created (dry run)')"
