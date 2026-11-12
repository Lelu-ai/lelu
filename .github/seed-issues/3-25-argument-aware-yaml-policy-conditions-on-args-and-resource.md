---
title: Argument-aware YAML policy (conditions on `args` and `resource`)
labels: help wanted,security,level-3-advanced
---
YAML rules match the action name only, so `read_invoices` with `{sql: "DROP TABLE"}` is allowed, and deny lists are defeated by renaming the action.

**What to do** add `when:` conditions to rules and scopes (for example `args.amount > 1000`, `resource.env == "prod"`) using CEL or a small expression language, with strict schema validation and a `lelu policy lint` command. Keep Rego for advanced cases and merge YAML and Rego results with the stricter outcome instead of replacing YAML.

Audit reference: POL-05, POL-08, POL-13, V10.
