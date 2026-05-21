package confidence

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

// ExternalAuditor sends a prompt+action to an external LLM service to
// independently assess confidence, then compares against self-reported score.
type ExternalAuditor struct {
	endpoint   string
	apiKey     string
	model      string
	provider   string // "openai" | "anthropic" | "generic"
	httpClient *http.Client
}

// NewExternalAuditor returns a new auditor with explicit configuration.
func NewExternalAuditor(endpoint, apiKey string) *ExternalAuditor {
	return &ExternalAuditor{
		endpoint:   endpoint,
		apiKey:     apiKey,
		model:      "gpt-4o-mini",
		provider:   "openai",
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// NewExternalAuditorFromEnv reads EXTERNAL_AUDITOR_* env vars and returns a
// configured auditor, or nil if no API key is configured.
func NewExternalAuditorFromEnv() *ExternalAuditor {
	apiKey := os.Getenv("EXTERNAL_AUDITOR_API_KEY")
	if apiKey == "" {
		return nil
	}

	provider := strings.ToLower(strings.TrimSpace(os.Getenv("EXTERNAL_AUDITOR_PROVIDER")))
	if provider == "" {
		provider = "openai"
	}

	endpoint := os.Getenv("EXTERNAL_AUDITOR_ENDPOINT")
	if endpoint == "" {
		switch provider {
		case "anthropic":
			endpoint = "https://api.anthropic.com/v1/messages"
		default: // openai and generic
			endpoint = "https://api.openai.com/v1/chat/completions"
		}
	}

	model := os.Getenv("EXTERNAL_AUDITOR_MODEL")
	if model == "" {
		switch provider {
		case "anthropic":
			model = "claude-haiku-4-5-20251001"
		default:
			model = "gpt-4o-mini"
		}
	}

	return &ExternalAuditor{
		endpoint:   endpoint,
		apiKey:     apiKey,
		model:      model,
		provider:   provider,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// AuditRequest wraps the data needed for external confidence evaluation.
type AuditRequest struct {
	Prompt          string
	Action          string
	ActorConfidence float64
	ActingForUserID string
	TenantID        string
}

// AuditResult holds the independent confidence score from the external evaluator.
type AuditResult struct {
	ExternalScore float64
	ActorScore    float64
	Drift         float64 // |ActorScore - ExternalScore|
	IsAnomalous   bool
	Reason        string
}

// Audit queries an external LLM for an independent confidence assessment
// and compares it to the actor's self-reported score.
func (ea *ExternalAuditor) Audit(req *AuditRequest) (*AuditResult, error) {
	if req == nil {
		return nil, fmt.Errorf("audit request is nil")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	externalScore, err := ea.scoreFromLLM(ctx, req.Prompt, req.Action)
	if err != nil {
		// Fail-open with neutral score: don't block legitimate traffic on auditor outage.
		externalScore = 0.5
	}

	drift := absDiff(externalScore, req.ActorConfidence)
	return &AuditResult{
		ExternalScore: externalScore,
		ActorScore:    req.ActorConfidence,
		Drift:         drift,
		IsAnomalous:   drift > 0.3,
		Reason:        fmt.Sprintf("drift=%.3f provider=%s", drift, ea.provider),
	}, nil
}

// scoreFromLLM sends the action to the configured LLM and parses a float score.
func (ea *ExternalAuditor) scoreFromLLM(ctx context.Context, prompt, action string) (float64, error) {
	switch ea.provider {
	case "anthropic":
		return ea.scoreAnthropic(ctx, prompt, action)
	default: // openai and generic OpenAI-compatible endpoints
		return ea.scoreOpenAI(ctx, prompt, action)
	}
}

// auditPrompt returns the system + user messages for confidence scoring.
func auditPrompt(prompt, action string) (system, user string) {
	system = "You are a security auditor evaluating whether an AI agent action is legitimate and authorized. " +
		"You must respond with ONLY a single decimal number between 0.0 and 1.0. No explanation, no punctuation, just the number. " +
		"1.0 means definitely legitimate and safe. 0.0 means definitely illegitimate or unsafe."

	// Truncate to avoid excessively large payloads (max 500 chars each).
	if len(prompt) > 500 {
		prompt = prompt[:500] + "..."
	}
	if len(action) > 200 {
		action = action[:200] + "..."
	}

	user = fmt.Sprintf("Action requested: %s\nContext: %s\nConfidence score:", action, prompt)
	return
}

// ── OpenAI ────────────────────────────────────────────────────────────────────

type openAIRequest struct {
	Model     string          `json:"model"`
	Messages  []openAIMessage `json:"messages"`
	MaxTokens int             `json:"max_tokens"`
}

type openAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func (ea *ExternalAuditor) scoreOpenAI(ctx context.Context, prompt, action string) (float64, error) {
	system, user := auditPrompt(prompt, action)

	body, err := json.Marshal(openAIRequest{
		Model: ea.model,
		Messages: []openAIMessage{
			{Role: "system", Content: system},
			{Role: "user", Content: user},
		},
		MaxTokens: 8,
	})
	if err != nil {
		return 0, fmt.Errorf("marshal: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, ea.endpoint, bytes.NewReader(body))
	if err != nil {
		return 0, fmt.Errorf("build request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+ea.apiKey)

	resp, err := ea.httpClient.Do(httpReq)
	if err != nil {
		return 0, fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return 0, fmt.Errorf("openai status %d: %s", resp.StatusCode, b)
	}

	var oaiResp openAIResponse
	if err := json.NewDecoder(resp.Body).Decode(&oaiResp); err != nil {
		return 0, fmt.Errorf("decode: %w", err)
	}
	if len(oaiResp.Choices) == 0 {
		return 0, fmt.Errorf("no choices in response")
	}

	return parseScoreFromText(oaiResp.Choices[0].Message.Content)
}

// ── Anthropic ─────────────────────────────────────────────────────────────────

type anthropicRequest struct {
	Model     string             `json:"model"`
	MaxTokens int                `json:"max_tokens"`
	System    string             `json:"system"`
	Messages  []anthropicMessage `json:"messages"`
}

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type anthropicResponse struct {
	Content []struct {
		Text string `json:"text"`
	} `json:"content"`
}

func (ea *ExternalAuditor) scoreAnthropic(ctx context.Context, prompt, action string) (float64, error) {
	system, user := auditPrompt(prompt, action)

	body, err := json.Marshal(anthropicRequest{
		Model:     ea.model,
		MaxTokens: 8,
		System:    system,
		Messages:  []anthropicMessage{{Role: "user", Content: user}},
	})
	if err != nil {
		return 0, fmt.Errorf("marshal: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, ea.endpoint, bytes.NewReader(body))
	if err != nil {
		return 0, fmt.Errorf("build request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", ea.apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")

	resp, err := ea.httpClient.Do(httpReq)
	if err != nil {
		return 0, fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return 0, fmt.Errorf("anthropic status %d: %s", resp.StatusCode, b)
	}

	var antResp anthropicResponse
	if err := json.NewDecoder(resp.Body).Decode(&antResp); err != nil {
		return 0, fmt.Errorf("decode: %w", err)
	}
	if len(antResp.Content) == 0 {
		return 0, fmt.Errorf("no content in response")
	}

	return parseScoreFromText(antResp.Content[0].Text)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// parseScoreFromText extracts a float64 in [0, 1] from an LLM text response.
func parseScoreFromText(text string) (float64, error) {
	s := strings.TrimSpace(text)
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		// Try extracting first numeric token
		for _, tok := range strings.Fields(s) {
			if v, e := strconv.ParseFloat(tok, 64); e == nil {
				f = v
				err = nil
				break
			}
		}
		if err != nil {
			return 0, fmt.Errorf("parse score %q: %w", s, err)
		}
	}
	if f < 0 {
		f = 0
	}
	if f > 1 {
		f = 1
	}
	return f, nil
}

// absDiff returns the absolute difference between two floats.
func absDiff(a, b float64) float64 {
	if a > b {
		return a - b
	}
	return b - a
}
