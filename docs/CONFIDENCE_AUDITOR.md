# Confidence Auditor — Design Overview

This document outlines the external confidence auditor that independently verifies self-reported confidence scores.

Components:
- `auditor.go` — submits prompt+action snapshot to Vertex (or alternative) for independent scoring
- `scorer.go` — computes drift between internal and external scores
- `escalator.go` — routes significant drift to human review or automated mitigation

Goals:
- Detect agents that misreport confidence to bypass gating
- Provide an audit trail for high-risk decisions
- Integrate with existing `pubsub/` and `confidence` pipelines

Privacy note:
- Auditor submissions should redact any sensitive PII before external transmission.
