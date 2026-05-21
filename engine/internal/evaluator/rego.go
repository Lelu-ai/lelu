package evaluator

import (
	"context"
	"fmt"
	"os"

	"github.com/open-policy-agent/opa/rego"
)

type regoPolicy struct {
	query rego.PreparedEvalQuery
}

func loadRegoPolicy(path, query string) (*regoPolicy, error) {
	if query == "" {
		query = "data.lelu.authz"
	}

	info, err := os.Stat(path)
	if err != nil {
		return nil, fmt.Errorf("evaluator: stat rego path: %w", err)
	}

	var options []func(*rego.Rego)

	if info.IsDir() {
		// Load all .rego files in the directory (Plugin support)
		entries, err := os.ReadDir(path)
		if err != nil {
			return nil, fmt.Errorf("evaluator: read rego dir: %w", err)
		}
		for _, entry := range entries {
			if !entry.IsDir() && len(entry.Name()) > 5 && entry.Name()[len(entry.Name())-5:] == ".rego" {
				filePath := path + "/" + entry.Name()
				policy, err := os.ReadFile(filePath)
				if err != nil {
					return nil, fmt.Errorf("evaluator: read rego policy %s: %w", filePath, err)
				}
				options = append(options, rego.Module(filePath, string(policy)))
			}
		}
	} else {
		// Load single file
		policy, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("evaluator: read rego policy: %w", err)
		}
		options = append(options, rego.Module(path, string(policy)))
	}

	options = append(options, rego.Query(query))

	r, err := rego.New(options...).PrepareForEval(context.Background())
	if err != nil {
		return nil, fmt.Errorf("evaluator: compile rego policy: %w", err)
	}
	return &regoPolicy{query: r}, nil
}

func (r *regoPolicy) EvaluateHuman(ctx context.Context, req AuthRequest) (*Decision, error) {
	input := map[string]any{
		"kind":     "human",
		"user_id":  req.UserID,
		"action":   req.Action,
		"resource": req.Resource,
	}
	return r.evaluate(ctx, input)
}

func (r *regoPolicy) EvaluateAgent(ctx context.Context, req AgentAuthRequest) (*Decision, error) {
	input := map[string]any{
		"kind":       "agent",
		"actor":      req.Actor,
		"action":     req.Action,
		"resource":   req.Resource,
		"confidence": req.Confidence,
		"acting_for": req.ActingFor,
		"scope":      req.Scope,
	}
	return r.evaluate(ctx, input)
}

func (r *regoPolicy) evaluate(ctx context.Context, input map[string]any) (*Decision, error) {
	results, err := r.query.Eval(ctx, rego.EvalInput(input))
	if err != nil {
		return nil, fmt.Errorf("evaluator: rego eval failed: %w", err)
	}
	if len(results) == 0 || len(results[0].Expressions) == 0 {
		return &Decision{Allowed: false, Reason: "rego policy returned no decision"}, nil
	}

	value := results[0].Expressions[0].Value
	switch v := value.(type) {
	case bool:
		if v {
			return &Decision{Allowed: true, Reason: "allowed by rego policy"}, nil
		}
		return &Decision{Allowed: false, Reason: "denied by rego policy"}, nil
	case map[string]any:
		return decisionFromMap(v), nil
	default:
		return nil, fmt.Errorf("evaluator: unsupported rego result type %T", value)
	}
}

// CheckDelegation evaluates a delegation request via the loaded Rego policy.
// The policy should handle input with kind="delegation". Returns nil (no
// decision) when the policy produces no result for delegation, allowing the
// caller to fall back to YAML rules.
func (r *regoPolicy) CheckDelegation(ctx context.Context, delegator, delegatee string, scopedTo []string, confidence float64) (*DelegationDecision, error) {
	input := map[string]any{
		"kind":       "delegation",
		"delegator":  delegator,
		"delegatee":  delegatee,
		"scoped_to":  scopedTo,
		"confidence": confidence,
	}
	results, err := r.query.Eval(ctx, rego.EvalInput(input))
	if err != nil {
		return nil, fmt.Errorf("evaluator: rego delegation eval: %w", err)
	}
	if len(results) == 0 || len(results[0].Expressions) == 0 {
		return nil, nil // no delegation rule in rego — fall through to YAML
	}
	value := results[0].Expressions[0].Value
	switch v := value.(type) {
	case bool:
		if v {
			return &DelegationDecision{
				Allowed:       true,
				Reason:        "allowed by rego policy",
				GrantedScopes: scopedTo,
			}, nil
		}
		return &DelegationDecision{Allowed: false, Reason: "denied by rego policy"}, nil
	case map[string]any:
		return delegationDecisionFromMap(v, scopedTo), nil
	default:
		return nil, nil // unrecognised type — fall through to YAML
	}
}

func delegationDecisionFromMap(v map[string]any, fallbackScopes []string) *DelegationDecision {
	dec := &DelegationDecision{}
	if allowed, ok := v["allowed"].(bool); ok {
		dec.Allowed = allowed
	}
	if reason, ok := v["reason"].(string); ok {
		dec.Reason = reason
	}
	if maxTTL, ok := v["max_ttl_seconds"].(float64); ok {
		dec.MaxTTL = int64(maxTTL)
	}
	if scopes, ok := v["granted_scopes"].([]interface{}); ok {
		for _, s := range scopes {
			if str, ok := s.(string); ok {
				dec.GrantedScopes = append(dec.GrantedScopes, str)
			}
		}
	}
	if len(dec.GrantedScopes) == 0 {
		dec.GrantedScopes = fallbackScopes
	}
	if dec.Reason == "" {
		if dec.Allowed {
			dec.Reason = "allowed by rego policy"
		} else {
			dec.Reason = "denied by rego policy"
		}
	}
	return dec
}

func decisionFromMap(v map[string]any) *Decision {
	dec := &Decision{}
	if allowed, ok := v["allowed"].(bool); ok {
		dec.Allowed = allowed
	}
	if reason, ok := v["reason"].(string); ok {
		dec.Reason = reason
	}
	if scope, ok := v["downgraded_scope"].(string); ok {
		dec.DowngradedScope = scope
	}
	if review, ok := v["requires_human_review"].(bool); ok {
		dec.RequiresHumanReview = review
	}
	if conf, ok := v["confidence_used"].(float64); ok {
		dec.ConfidenceUsed = conf
	}
	if dec.Reason == "" {
		if dec.Allowed {
			dec.Reason = "allowed by rego policy"
		} else {
			dec.Reason = "denied by rego policy"
		}
	}
	return dec
}
