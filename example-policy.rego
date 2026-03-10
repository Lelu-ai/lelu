package lelu.auth

import future.keywords.in

# Default deny
default allow = false
default require_approval = false

# ---------------------------------------------------------
# High Confidence: Auto-Approve
# ---------------------------------------------------------
allow {
    input.action == "read_data"
    input.confidence >= 0.80
}

allow {
    input.action == "generate_report"
    input.confidence >= 0.90
    input.risk_level == "low"
}

# ---------------------------------------------------------
# Medium Confidence: Require Human Approval
# ---------------------------------------------------------
require_approval {
    input.action == "send_email"
    input.confidence < 0.95
    input.confidence >= 0.70
}

require_approval {
    input.action == "generate_report"
    input.risk_level == "high"
}

# ---------------------------------------------------------
# Low Confidence: Auto-Deny (Implicit via default)
# ---------------------------------------------------------