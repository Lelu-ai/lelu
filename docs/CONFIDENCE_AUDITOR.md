# Confidence Auditor

Detects agents that misreport their confidence score to bypass authorization gates. An external service independently scores the same prompt+action and the drift between the two scores determines whether to allow, downgrade, or escalate to human review.

## Status

Core pipeline implemented. External auditor (`auditor.go`) is a stub returning a fixed score of `0.75` — replacing it with a real Vertex AI / LLM call is the remaining work.

## Components

### `confidence.go` — Gate
The primary per-request confidence check. Evaluates a score against configurable thresholds:

| Score | Outcome |
|-------|---------|
| ≥ 0.90 | Full permission — autonomous action allowed |
| 0.70 – 0.89 | Human review required |
| 0.50 – 0.69 | Scope downgraded to `read_only` |
| < 0.50 | Hard deny + security alert |

Thresholds are overridable per agent scope via `Policy`.

### `extract.go` — Signal extraction
Converts raw model outputs to a `[0, 1]` confidence score:

| Provider | Input | Method |
|----------|-------|--------|
| `openai` | `token_logprobs` | Mean of `exp(logprob)` per token |
| `anthropic` | `token_logprobs` | Same path (see known gaps) |
| `local` | `token_probabilities` | Mean of probabilities |
| `local` | `entropy` / `entropy_max` | `1 - (entropy / entropy_max)` |

### `auditor.go` — External auditor
Sends a snapshot of the prompt and action to an external scoring service and returns an `AuditResult`:

```go
type AuditResult struct {
    ExternalScore float64  // independent score from external service
    ActorScore    float64  // agent's self-reported score
    Drift         float64  // |ActorScore - ExternalScore|
    IsAnomalous   bool     // drift > 0.30
    Reason        string
}
```

**Current state:** `computeDummyExternalScore()` always returns `0.75` — a placeholder. Replace with a real HTTP call to Vertex AI or a similar service.

### `scorer.go` — Drift scorer
Classifies the drift magnitude:

| Drift | Severity |
|-------|----------|
| < 0.10 | `none` |
| 0.10 – 0.29 | `low` |
| 0.30 – 0.49 | `medium` |
| ≥ 0.50 | `high` |

### `escalator.go` — Escalator
Decides what to do with the drift finding and can submit it to the human-review queue:

```
SeverityHigh   → ActionReview  (enqueue for human)
SeverityMedium → ActionReview  (external score ≥ 0.5)
               → ActionDeny    (external score < 0.5)
SeverityLow    → ActionAllow
```

**Key methods:**

| Method | Description |
|--------|-------------|
| `Escalate(result, severity)` | Returns the recommended action |
| `EnqueueReview(ctx, auditReq, result, severity)` | Submits to the review queue when action is `ActionReview` |
| `CreateReviewTask(result, severity, auditReq)` | Builds a task map for logging/inspection |

The `ReviewEnqueuer` interface is satisfied by `*queue.Queue`:

```go
type ReviewEnqueuer interface {
    Enqueue(ctx, tenantID, actor, action string,
        resource map[string]string, confidence float64,
        reason, actingFor string) (string, error)
}
```

Pass `nil` for a no-op escalator (tests).

## Full pipeline

```
Agent request
      │
      ▼
ExtractScore(signal)          ← extract.go
      │ score ∈ [0,1]
      ▼
Gate.Evaluate(score, policy)  ← confidence.go
      │
      ├─ LevelFullPermission → allow
      ├─ LevelRequiresHuman  → queue for review
      ├─ LevelReadOnly       → downgrade scope
      └─ LevelHardDeny       → deny
      
      ↓ (optional external audit path)
      
ExternalAuditor.Audit(req)    ← auditor.go  [currently stubbed]
      │ AuditResult
      ▼
Scorer.AssessSeverity()       ← scorer.go
      │ SeverityLevel
      ▼
Escalator.EnqueueReview()     ← escalator.go
      │ queued review ID
      ▼
queue.Queue.Enqueue()         ← queue package
```

## Privacy

- Audit submissions must redact sensitive PII before transmission to any external service.
- `CreateReviewTask` stores a FNV hash of the prompt (not the raw text) in the queue payload to avoid leaking user input.

## Known gaps

| Gap | File | Severity |
|-----|------|----------|
| `ExternalAuditor.Audit()` always returns 0.75 | `auditor.go` | High |
| `ProviderAnthropic` uses OpenAI logprob path; Anthropic API format differs | `extract.go` | Low |
| External audit pipeline not called from `server.go` — only `Gate` is used | `server.go` | Medium |

To complete the external audit path, wire `ExternalAuditor` + `Escalator.EnqueueReview` into `handleAgentAuthorize` after the main decision, running asynchronously (goroutine) to avoid adding latency to the hot path.
