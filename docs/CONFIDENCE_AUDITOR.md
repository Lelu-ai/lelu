# Confidence Auditor

Detects agents that misreport their confidence score to bypass authorization gates. An external service independently scores the same prompt+action and the drift between the two scores determines whether to allow, downgrade, or escalate to human review.

## Status

Fully implemented. The external auditor (`auditor.go`) makes a real HTTP call to OpenAI or Anthropic (`scoreOpenAI`/`scoreAnthropic`) and fails closed — propagating the error rather than returning a neutral score — if that call fails. It's wired into `handleAgentAuthorize` in `server.go` and runs asynchronously so it doesn't add latency to the decision path.

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
| `anthropic` | — | Always errors — Anthropic exposes no token-level log-probs on any model, so a signal claiming that provenance can't be genuine. Omit the signal and let `MissingSignalMode` decide. |
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

**Current state:** implemented. `scoreFromLLM` dispatches to `scoreOpenAI` or `scoreAnthropic` depending on configured provider, each making a real API call and parsing the returned score from the model's response text.

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
      
      ↓ (optional external audit path, runs async)
      
ExternalAuditor.Audit(req)    ← auditor.go
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

None currently open for this pipeline. The three previously listed here — `ExternalAuditor.Audit()` returning a hardcoded score, the Anthropic signal path reusing OpenAI's log-prob branch, and the external audit pipeline not being called from `server.go` — are all resolved as of 2026-08-01.
