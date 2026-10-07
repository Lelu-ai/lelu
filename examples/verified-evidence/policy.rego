package lelu.authz

import rego.v1

# Synthetic example only. External evidence is an input to Lelu policy, never
# legal clearance and never an automatic authorization decision.

default authz := {
	"allowed": false,
	"requires_human_review": true,
	"reason": "external rights evidence is missing or requires review",
}

authz := {
	"allowed": true,
	"requires_human_review": false,
	"reason": "configured policy accepts current declared-permitted evidence",
} if {
	input.kind == "agent"
	evidence := input.args.external_evidence
	evidence.provider != ""
	evidence.observed_at != ""
	evidence.evidence_ref != ""
	evidence.receipt_digest != ""
	evidence.declaration_state == "declared_permitted"
}
