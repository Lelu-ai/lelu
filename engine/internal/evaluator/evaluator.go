// Package evaluator implements OPA-style policy evaluation for YAML-defined
// RBAC + agent-scoped policies.
package evaluator

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"strings"
	"sync"

	"gopkg.in/yaml.v3"
)

// ─── Domain types ────────────────────────────────────────────────────────────

// AuthRequest represents a human authorization check.
type AuthRequest struct {
	TenantID string            `json:"tenant_id"`
	UserID   string            `json:"user_id"`
	Action   string            `json:"action"`
	Resource map[string]string `json:"resource"`
}

// AgentAuthRequest represents an agent authorization check.
type AgentAuthRequest struct {
	TenantID   string            `json:"tenant_id"`
	Actor      string            `json:"actor"`
	Action     string            `json:"action"`
	Resource   map[string]string `json:"resource"`
	Confidence float64           `json:"confidence"`
	ActingFor  string            `json:"acting_for"`
	Scope      string            `json:"scope"`
}

// Decision is the output of the policy evaluation.
type Decision struct {
	Allowed             bool                   `json:"allowed"`
	Reason              string                 `json:"reason"`
	DowngradedScope     string                 `json:"downgraded_scope,omitempty"`
	RequiresHumanReview bool                   `json:"requires_human_review"`
	ConfidenceUsed      float64                `json:"confidence_used,omitempty"`
	// Compute fields — set when a compute rule matches instead of allow/deny.
	Compute  bool                   `json:"compute,omitempty"`
	SafeTool string                 `json:"safe_tool,omitempty"`
	SafeArgs map[string]interface{} `json:"safe_args,omitempty"`
	// PolicyDigest is the SHA-256 of the policy bytes active at evaluation time.
	PolicyDigest string `json:"policy_digest,omitempty"`
}

// ─── Policy Schema ────────────────────────────────────────────────────────────

// Policy is the top-level schema for auth.yaml.
type Policy struct {
	Version     string                `yaml:"version"`
	Roles       map[string]Role       `yaml:"roles"`
	AgentScopes map[string]AgentScope `yaml:"agent_scopes"`
}

// Role maps a role name to its allowed/denied actions.
type Role struct {
	Allow []string `yaml:"allow"`
	Deny  []string `yaml:"deny"`
}

// ComputeRule routes a matching action to a safe alternative instead of blocking.
type ComputeRule struct {
	Action   string                 `yaml:"action"`
	SafeTool string                 `yaml:"safe_tool"`
	SafeArgs map[string]interface{} `yaml:"safe_args"`
}

// AgentScope defines agent-specific rules, inheriting from a Role.
type AgentScope struct {
	Inherits    string           `yaml:"inherits"`
	Constraints []Constraint     `yaml:"constraints"`
	Deny        []string         `yaml:"deny"`
	Compute     []ComputeRule    `yaml:"compute"`     // safe-redirect rules
	CanDelegate []DelegationRule `yaml:"can_delegate"` // agent-to-agent delegation rules
}

// DelegationRule defines what scope an agent can delegate to another agent.
type DelegationRule struct {
	// To is the delegatee agent scope name.
	To string `yaml:"to"`
	// ScopedTo is the list of actions the delegatee is allowed to perform.
	ScopedTo []string `yaml:"scoped_to"`
	// MaxTTLSeconds caps the lifetime of the delegated child token.
	MaxTTLSeconds int64 `yaml:"max_ttl_seconds"`
	// RequireConfidenceAbove mandates a minimum confidence score for delegation.
	RequireConfidenceAbove float64 `yaml:"require_confidence_above"`
}

// DelegationDecision is the result of a delegation authorization check.
type DelegationDecision struct {
	Allowed       bool     `json:"allowed"`
	Reason        string   `json:"reason"`
	GrantedScopes []string `json:"granted_scopes,omitempty"`
	MaxTTL        int64    `json:"max_ttl_seconds,omitempty"`
}

// Constraint is a single named constraint value pair.
type Constraint struct {
	MaxRefundAmount            *float64 `yaml:"max_refund_amount,omitempty"`
	RequireHumanApprovalIfConf *float64 `yaml:"require_human_approval_if_confidence_below,omitempty"`
	DowngradeToReadOnlyIfConf  *float64 `yaml:"downgrade_to_read_only_if_confidence_below,omitempty"`
	HardDenyIfConf             *float64 `yaml:"hard_deny_if_confidence_below,omitempty"`
}

// ─── Evaluator ───────────────────────────────────────────────────────────────

// Evaluator holds the active policy and evaluates auth requests.
type Evaluator struct {
	mu           sync.RWMutex
	policy       *Policy
	rego         *regoPolicy
	policyDigest string // SHA-256 hex of last loaded policy bytes
}

// PolicyDigest returns the SHA-256 hex digest of the currently loaded policy.
func (e *Evaluator) PolicyDigest() string {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.policyDigest
}

// New returns a default Evaluator with an empty policy.
func New() *Evaluator {
	return &Evaluator{policy: &Policy{
		Roles:       make(map[string]Role),
		AgentScopes: make(map[string]AgentScope),
	}}
}

// LoadPolicy reads and parses a YAML policy file, then hot-swaps it in.
func (e *Evaluator) LoadPolicy(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("evaluator: read policy: %w", err)
	}
	return e.LoadPolicyBytes(data)
}

// LoadPolicyBytes parses and hot-swaps policy from raw YAML bytes.
func (e *Evaluator) LoadPolicyBytes(data []byte) error {
	var p Policy
	if err := yaml.Unmarshal(data, &p); err != nil {
		return fmt.Errorf("evaluator: parse policy: %w", err)
	}
	sum := sha256.Sum256(data)
	digest := hex.EncodeToString(sum[:])
	e.mu.Lock()
	e.policy = &p
	e.policyDigest = digest
	e.mu.Unlock()
	return nil
}

// matchAction checks whether a policy pattern matches an action string.
//
// Supported pattern syntax:
//
//	"*"           — matches everything
//	"read_*"      — prefix wildcard (action must start with "read_")
//	"*_prod"      — suffix wildcard (action must end with "_prod")
//	"*_prod_*"    — contains wildcard (action must contain "_prod_")
//	"read_file"   — exact match (no wildcards)
func matchAction(pattern, action string) bool {
	if pattern == "*" {
		return true
	}
	// Both prefix and suffix wildcard → contains check.
	if strings.HasPrefix(pattern, "*") && strings.HasSuffix(pattern, "*") && len(pattern) > 1 {
		middle := pattern[1 : len(pattern)-1]
		return strings.Contains(action, middle)
	}
	// Prefix wildcard → suffix check on action.
	if strings.HasSuffix(pattern, "*") {
		return strings.HasPrefix(action, pattern[:len(pattern)-1])
	}
	// Suffix wildcard → prefix check on action.
	if strings.HasPrefix(pattern, "*") {
		return strings.HasSuffix(action, pattern[1:])
	}
	return pattern == action
}

// Evaluate checks a human auth request against the loaded policy.
func (e *Evaluator) Evaluate(ctx context.Context, req AuthRequest) (*Decision, error) {
	e.mu.RLock()
	p := e.policy
	rp := e.rego
	e.mu.RUnlock()

	if rp != nil {
		return rp.EvaluateHuman(ctx, req)
	}

	// Walk all roles — deny rules checked first, then allow (deny wins).
	for _, role := range p.Roles {
		for _, denied := range role.Deny {
			if matchAction(denied, req.Action) {
				return &Decision{Allowed: false, Reason: fmt.Sprintf("action %q is explicitly denied by pattern %q", req.Action, denied)}, nil
			}
		}
	}
	for _, role := range p.Roles {
		for _, allowed := range role.Allow {
			if matchAction(allowed, req.Action) {
				return &Decision{Allowed: true, Reason: fmt.Sprintf("action %q allowed by pattern %q", req.Action, allowed)}, nil
			}
		}
	}
	return &Decision{Allowed: false, Reason: fmt.Sprintf("no policy permits action %q", req.Action)}, nil
}

// EvaluateAgent checks an agent auth request with confidence-aware logic.
func (e *Evaluator) EvaluateAgent(ctx context.Context, req AgentAuthRequest) (*Decision, error) {
	e.mu.RLock()
	p := e.policy
	rp := e.rego
	e.mu.RUnlock()

	if rp != nil {
		return rp.EvaluateAgent(ctx, req)
	}

	scope, ok := p.AgentScopes[req.Actor]
	if !ok {
		return &Decision{Allowed: false, Reason: fmt.Sprintf("unknown agent scope %q", req.Actor), PolicyDigest: e.policyDigest}, nil
	}

	// Hard deny overrides — wildcard-aware.
	for _, denied := range scope.Deny {
		if matchAction(denied, req.Action) {
			return &Decision{Allowed: false, Reason: fmt.Sprintf("action %q is hard-denied for agent %q by pattern %q", req.Action, req.Actor, denied), PolicyDigest: e.policyDigest}, nil
		}
	}

	// Compute rules — safe redirect instead of block/allow.
	for _, cr := range scope.Compute {
		if matchAction(cr.Action, req.Action) {
			return &Decision{
				Allowed:      true,
				Compute:      true,
				SafeTool:     cr.SafeTool,
				SafeArgs:     cr.SafeArgs,
				Reason:       fmt.Sprintf("action %q redirected to safe alternative %q by compute rule", req.Action, cr.SafeTool),
				PolicyDigest: e.policyDigest,
			}, nil
		}
	}

	// Confidence gates from constraints.
	dec := &Decision{Allowed: true, ConfidenceUsed: req.Confidence, PolicyDigest: e.policyDigest}
	for _, c := range scope.Constraints {
		if c.HardDenyIfConf != nil && req.Confidence < *c.HardDenyIfConf {
			dec.Allowed = false
			dec.Reason = fmt.Sprintf("confidence %.0f%% is below hard-deny threshold %.0f%%", req.Confidence*100, *c.HardDenyIfConf*100)
			return dec, nil
		}
		if c.DowngradeToReadOnlyIfConf != nil && req.Confidence < *c.DowngradeToReadOnlyIfConf {
			dec.Allowed = false
			dec.DowngradedScope = "read_only"
			dec.Reason = fmt.Sprintf("confidence %.0f%% requires read-only downgrade (threshold %.0f%%)", req.Confidence*100, *c.DowngradeToReadOnlyIfConf*100)
			return dec, nil
		}
		if c.RequireHumanApprovalIfConf != nil && req.Confidence < *c.RequireHumanApprovalIfConf {
			dec.RequiresHumanReview = true
			dec.Reason = fmt.Sprintf("confidence %.0f%% requires human approval (threshold %.0f%%)", req.Confidence*100, *c.RequireHumanApprovalIfConf*100)
		}
	}

	// Check inherited role permissions.
	if scope.Inherits != "" {
		role, found := p.Roles[scope.Inherits]
		if !found {
			return &Decision{Allowed: false, Reason: fmt.Sprintf("inherited role %q not found", scope.Inherits)}, nil
		}
		permitted := false
		for _, a := range role.Allow {
			if matchAction(a, req.Action) {
				permitted = true
				break
			}
		}
		if !permitted {
			return &Decision{Allowed: false, Reason: fmt.Sprintf("action %q not in inherited role %q", req.Action, scope.Inherits), PolicyDigest: e.policyDigest}, nil
		}
	}

	if dec.Reason == "" {
		dec.Reason = "action authorized"
	}
	return dec, nil
}

// CheckDelegation validates whether delegator can delegate scopedTo actions
// to delegatee at the given confidence. Returns the matching DelegationRule
// details on success.
func (e *Evaluator) CheckDelegation(ctx context.Context, delegator, delegatee string, scopedTo []string, confidence float64) (*DelegationDecision, error) {
	e.mu.RLock()
	p := e.policy
	rp := e.rego
	e.mu.RUnlock()

	// Try Rego first; nil return means "no delegation rule defined" → fall through.
	if rp != nil {
		dec, err := rp.CheckDelegation(ctx, delegator, delegatee, scopedTo, confidence)
		if err != nil {
			return nil, err
		}
		if dec != nil {
			return dec, nil
		}
	}

	scope, ok := p.AgentScopes[delegator]
	if !ok {
		return &DelegationDecision{
			Allowed: false,
			Reason:  fmt.Sprintf("unknown delegator agent scope %q", delegator),
		}, nil
	}

	for _, rule := range scope.CanDelegate {
		if rule.To != delegatee {
			continue
		}

		// Confidence check.
		if rule.RequireConfidenceAbove > 0 && confidence < rule.RequireConfidenceAbove {
			return &DelegationDecision{
				Allowed: false,
				Reason: fmt.Sprintf(
					"delegation requires confidence ≥ %.0f%% (got %.0f%%)",
					rule.RequireConfidenceAbove*100, confidence*100,
				),
			}, nil
		}

		// Validate requested scopes are a subset of the rule's scoped_to.
		allowed := make(map[string]struct{}, len(rule.ScopedTo))
		for _, s := range rule.ScopedTo {
			allowed[s] = struct{}{}
		}
		for _, req := range scopedTo {
			if _, ok := allowed[req]; !ok {
				return &DelegationDecision{
					Allowed: false,
					Reason:  fmt.Sprintf("scope %q is not permitted in delegation rule from %q to %q", req, delegator, delegatee),
				}, nil
			}
		}

		grantedScopes := scopedTo
		if len(grantedScopes) == 0 {
			grantedScopes = rule.ScopedTo
		}

		return &DelegationDecision{
			Allowed:       true,
			Reason:        fmt.Sprintf("delegation from %q to %q authorized", delegator, delegatee),
			GrantedScopes: grantedScopes,
			MaxTTL:        rule.MaxTTLSeconds,
		}, nil
	}

	return &DelegationDecision{
		Allowed: false,
		Reason:  fmt.Sprintf("no delegation rule from %q to %q", delegator, delegatee),
	}, nil
}

// LoadRegoPolicy enables OPA/Rego evaluation mode.
// Query must point to a rule that returns either a boolean or an object:
//
//	{
//	  "allowed": bool,
//	  "reason": string,
//	  "downgraded_scope": string,
//	  "requires_human_review": bool
//	}
func (e *Evaluator) LoadRegoPolicy(path, query string) error {
	rp, err := loadRegoPolicy(path, query)
	if err != nil {
		return err
	}
	e.mu.Lock()
	e.rego = rp
	e.mu.Unlock()
	return nil
}
