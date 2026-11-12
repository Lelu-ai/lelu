package lelu

import rego.v1

default authz = {
  "allowed": false,
  "reason": "default deny"
}

# Skill: Low-risk read operation for an AI tool caller
allow_read_tool if {
  input.kind == "agent"
  input.action == "tool.read"
  startswith(input.resource, "kb:")
  input.confidence >= 0.80
}

authz = {
  "allowed": true,
  "reason": "skill: tool-call read access"
} if allow_read_tool

# Route uncertain reads to human approval
review_read_tool if {
  input.kind == "agent"
  input.action == "tool.read"
  startswith(input.resource, "kb:")
  input.confidence >= 0.60
  input.confidence < 0.80
}

authz = {
  "allowed": true,
  "requires_human_review": true,
  "reason": "skill: uncertain tool read requires human review"
} if review_read_tool
