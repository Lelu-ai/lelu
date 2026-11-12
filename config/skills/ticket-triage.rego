package lelu

import rego.v1

default authz = {
  "allowed": false,
  "reason": "default deny"
}

# Skill: customer-support ticket triage actions
allow_ticket_triage if {
  input.kind == "agent"
  input.action == "tickets.classify"
  startswith(input.resource, "ticket:")
  input.confidence >= 0.85
}

authz = {
  "allowed": true,
  "reason": "skill: ticket triage allowed"
} if allow_ticket_triage

review_ticket_triage if {
  input.kind == "agent"
  input.action == "tickets.classify"
  startswith(input.resource, "ticket:")
  input.confidence >= 0.70
  input.confidence < 0.85
}

authz = {
  "allowed": true,
  "requires_human_review": true,
  "reason": "skill: ticket triage needs review"
} if review_ticket_triage
