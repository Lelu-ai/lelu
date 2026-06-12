package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/lelu-auth/lelu/engine/internal/confidence"
	"github.com/lelu-auth/lelu/engine/internal/evaluator"
)

const usage = `Lelu Policy Dry-Run CLI

Usage:
  lelu-cli [options]

Options:
  -policy string
        Path to auth.yaml policy file (required)
  -input string
        Path to JSON input file with authorization request (required)
  -type string
        Request type: "human" or "agent" (default "agent")
  -rego string
        Optional path to Rego policy file or directory
  -rego-query string
        Rego policy query (default "data.lelu.authz")

Examples:
  # Test agent authorization
  lelu-cli -policy config/auth.yaml -input test-request.json -type agent

  # Test human authorization
  lelu-cli -policy config/auth.yaml -input test-request.json -type human

  # Test with Rego policy
  lelu-cli -policy config/auth.yaml -rego config/auth.rego -input test-request.json

Input JSON format for agent requests:
{
  "tenant_id": "acme-corp",
  "actor": "invoice_bot",
  "action": "approve_refunds",
  "resource": {"amount": "500"},
  "confidence": 0.92,
  "acting_for": "user_123",
  "scope": "invoice_bot"
}

Input JSON format for human requests:
{
  "tenant_id": "acme-corp",
  "user_id": "user_123",
  "action": "approve_refunds",
  "resource": {"amount": "500"}
}
`

type AgentRequest struct {
	TenantID   string            `json:"tenant_id"`
	Actor      string            `json:"actor"`
	Action     string            `json:"action"`
	Resource   map[string]string `json:"resource"`
	Confidence float64           `json:"confidence"`
	ActingFor  string            `json:"acting_for"`
	Scope      string            `json:"scope"`
}

type HumanRequest struct {
	TenantID string            `json:"tenant_id"`
	UserID   string            `json:"user_id"`
	Action   string            `json:"action"`
	Resource map[string]string `json:"resource"`
}

func main() {
	policyPath := flag.String("policy", "", "Path to auth.yaml policy file")
	inputPath := flag.String("input", "", "Path to JSON input file")
	reqType := flag.String("type", "agent", "Request type: human or agent")
	regoPath := flag.String("rego", "", "Optional path to Rego policy file or directory")
	regoQuery := flag.String("rego-query", "data.lelu.authz", "Rego policy query")
	flag.Usage = func() {
		fmt.Fprint(os.Stderr, usage)
	}
	flag.Parse()

	if *policyPath == "" || *inputPath == "" {
		flag.Usage()
		os.Exit(1)
	}

	// Load policy
	eval := evaluator.New()
	if err := eval.LoadPolicy(*policyPath); err != nil {
		log.Fatalf("Failed to load policy from %s: %v", *policyPath, err)
	}
	fmt.Printf("✓ Policy loaded from %s\n", *policyPath)

	// Load optional Rego policy
	if *regoPath != "" {
		if err := eval.LoadRegoPolicy(*regoPath, *regoQuery); err != nil {
			log.Fatalf("Failed to load Rego policy from %s: %v", *regoPath, err)
		}
		fmt.Printf("✓ Rego policy loaded from %s (query: %s)\n", *regoPath, *regoQuery)
	}

	// Read input file
	inputData, err := os.ReadFile(*inputPath)
	if err != nil {
		log.Fatalf("Failed to read input file %s: %v", *inputPath, err)
	}

	ctx := context.Background()

	switch *reqType {
	case "agent":
		var req AgentRequest
		if err := json.Unmarshal(inputData, &req); err != nil {
			log.Fatalf("Failed to parse agent request JSON: %v", err)
		}
		evaluateAgent(ctx, eval, req)

	case "human":
		var req HumanRequest
		if err := json.Unmarshal(inputData, &req); err != nil {
			log.Fatalf("Failed to parse human request JSON: %v", err)
		}
		evaluateHuman(ctx, eval, req)

	default:
		log.Fatalf("Invalid request type: %s (must be 'agent' or 'human')", *reqType)
	}
}

func evaluateAgent(ctx context.Context, eval *evaluator.Evaluator, req AgentRequest) {
	fmt.Println("\n─── Agent Authorization Request ───")
	fmt.Printf("Tenant:     %s\n", req.TenantID)
	fmt.Printf("Actor:      %s\n", req.Actor)
	fmt.Printf("Action:     %s\n", req.Action)
	fmt.Printf("Resource:   %v\n", req.Resource)
	fmt.Printf("Confidence: %.2f\n", req.Confidence)
	fmt.Printf("Acting For: %s\n", req.ActingFor)
	fmt.Printf("Scope:      %s\n", req.Scope)

	// Evaluate confidence gate
	confGate := confidence.New()
	confDec, err := confGate.Evaluate(ctx, req.Confidence, nil)
	if err != nil {
		log.Fatalf("Confidence evaluation error: %v", err)
	}

	fmt.Println("\n─── Confidence Gate ───")
	fmt.Printf("Level:  %s\n", confDec.Level)
	fmt.Printf("Reason: %s\n", confDec.Reason)
	if confDec.Level == confidence.LevelHardDeny {
		fmt.Println("\n❌ DENIED by confidence gate")
		fmt.Printf("Reason: %s\n", confDec.Reason)
		return
	}
	if confDec.RequiresHumanReview {
		fmt.Println("\n⚠️  REQUIRES HUMAN REVIEW (confidence gate)")
	}

	// Evaluate policy
	dec, err := eval.EvaluateAgent(ctx, evaluator.AgentAuthRequest{
		TenantID:   req.TenantID,
		Actor:      req.Actor,
		Action:     req.Action,
		Resource:   req.Resource,
		Confidence: req.Confidence,
		ActingFor:  req.ActingFor,
		Scope:      req.Scope,
	})
	if err != nil {
		log.Fatalf("Policy evaluation error: %v", err)
	}

	fmt.Println("\n─── Policy Evaluation ───")
	fmt.Printf("Allowed:             %t\n", dec.Allowed)
	fmt.Printf("Reason:              %s\n", dec.Reason)
	fmt.Printf("Requires Review:     %t\n", dec.RequiresHumanReview)
	if dec.DowngradedScope != "" {
		fmt.Printf("Downgraded Scope:    %s\n", dec.DowngradedScope)
	}

	// Final decision
	fmt.Println("\n─── Final Decision ───")
	requiresReview := dec.RequiresHumanReview || confDec.RequiresHumanReview
	if requiresReview {
		fmt.Println("⚠️  REQUIRES HUMAN REVIEW")
		fmt.Printf("Reason: %s\n", dec.Reason)
	} else if dec.Allowed {
		fmt.Println("✅ ALLOWED")
		fmt.Printf("Reason: %s\n", dec.Reason)
	} else {
		fmt.Println("❌ DENIED")
		fmt.Printf("Reason: %s\n", dec.Reason)
	}
}

func evaluateHuman(ctx context.Context, eval *evaluator.Evaluator, req HumanRequest) {
	fmt.Println("\n─── Human Authorization Request ───")
	fmt.Printf("Tenant:   %s\n", req.TenantID)
	fmt.Printf("User ID:  %s\n", req.UserID)
	fmt.Printf("Action:   %s\n", req.Action)
	fmt.Printf("Resource: %v\n", req.Resource)

	dec, err := eval.Evaluate(ctx, evaluator.AuthRequest{
		TenantID: req.TenantID,
		UserID:   req.UserID,
		Action:   req.Action,
		Resource: req.Resource,
	})
	if err != nil {
		log.Fatalf("Policy evaluation error: %v", err)
	}

	fmt.Println("\n─── Policy Evaluation ───")
	fmt.Printf("Allowed: %t\n", dec.Allowed)
	fmt.Printf("Reason:  %s\n", dec.Reason)

	fmt.Println("\n─── Final Decision ───")
	if dec.Allowed {
		fmt.Println("✅ ALLOWED")
		fmt.Printf("Reason: %s\n", dec.Reason)
	} else {
		fmt.Println("❌ DENIED")
		fmt.Printf("Reason: %s\n", dec.Reason)
	}
}
