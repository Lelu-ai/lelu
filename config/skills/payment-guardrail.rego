package lelu

import rego.v1

default authz = {
  "allowed": false,
  "reason": "default deny"
}

# Skill: payment operation guardrail
allow_payment_refund if {
  input.kind == "agent"
  input.action == "payments.refund"
  startswith(input.resource, "payment:")
  input.confidence >= 0.95
}

authz = {
  "allowed": true,
  "reason": "skill: payment refund allowed"
} if allow_payment_refund

review_payment_refund if {
  input.kind == "agent"
  input.action == "payments.refund"
  startswith(input.resource, "payment:")
  input.confidence >= 0.85
  input.confidence < 0.95
}

authz = {
  "allowed": true,
  "requires_human_review": true,
  "reason": "skill: payment refund requires human review"
} if review_payment_refund
