package lelu

import rego.v1

# Default deny
default authz = {
  "allowed": false,
  "reason": "default deny"
}

# Human auth example: allow specific actions
human_allow if {
  input.kind == "human"
  input.action == "view_invoices"
}

# Agent auth example with confidence-aware branching
agent_full_allow if {
  input.kind == "agent"
  input.action == "approve_refunds"
  input.confidence >= 0.9
}

agent_review if {
  input.kind == "agent"
  input.action == "approve_refunds"
  input.confidence >= 0.7
  input.confidence < 0.9
}

agent_downgrade if {
  input.kind == "agent"
  input.action == "approve_refunds"
  input.confidence >= 0.5
  input.confidence < 0.7
}

authz = {
  "allowed": true,
  "reason": "allowed by rego policy"
} if human_allow

authz = {
  "allowed": true,
  "reason": "allowed by rego policy"
} if agent_full_allow

authz = {
  "allowed": true,
  "requires_human_review": true,
  "reason": "confidence requires human review"
} if agent_review

authz = {
  "allowed": false,
  "downgraded_scope": "read_only",
  "reason": "confidence requires read-only downgrade"
} if agent_downgrade
