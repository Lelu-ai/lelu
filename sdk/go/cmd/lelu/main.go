package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/lelu-auth/lelu/sdk/go"
)

func printHelp() {
	fmt.Print(`
Lelu CLI

Usage:
  lelu audit-log         View recent audit events
  lelu policies          Manage authorization policies
  lelu help              Show this help

Commands:
  audit-log              View audit trail and authorization events
  policies list          List all policies
  policies get <name>    Get a specific policy
  policies set <name> <file>  Create or update a policy from file
  policies delete <name> Delete a policy

Storage:
  Default: Local SQLite (~/.lelu/lelu.db)
  Remote:  Set LELU_PLATFORM_URL environment variable

Environment Variables:
  LELU_PLATFORM_URL       Platform API URL (uses local SQLite if not set)
  LELU_PLATFORM_API_KEY   Platform API key (default: platform-dev-key)
  LELU_TENANT_ID          Tenant ID (default: default)
  LELU_AUDIT_LIMIT        Number of events to fetch (default: 20)

Examples:
  lelu audit-log                              # View from local storage
  lelu policies list                          # List from local storage
  lelu policies set auth ./auth.rego          # Save to local storage
  LELU_PLATFORM_URL=https://lelu.example.com lelu audit-log  # Use remote
`)
}

func showAuditLog() error {
	platformURL := os.Getenv("LELU_PLATFORM_URL")
	limitStr := os.Getenv("LELU_AUDIT_LIMIT")
	if limitStr == "" {
		limitStr = "20"
	}
	limit, err := strconv.ParseInt(limitStr, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid LELU_AUDIT_LIMIT: %w", err)
	}

	// Priority: 1. Platform URL, 2. Local SQLite
	if platformURL != "" {
		return showAuditLogPlatform(platformURL, limit)
	}
	return showAuditLogLocal(limit)
}

func showAuditLogPlatform(platformURL string, limit int64) error {
	apiKey := os.Getenv("LELU_PLATFORM_API_KEY")
	if apiKey == "" {
		apiKey = "platform-dev-key"
	}

	fmt.Printf("🌐 Using platform: %s\n\n", platformURL)

	client := lelu.NewClient(lelu.ClientConfig{
		BaseURL: platformURL,
		APIKey:  apiKey,
		Timeout: 10 * time.Second,
	})

	ctx := context.Background()

	// Check if service is reachable
	healthCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	healthReq, err := http.NewRequestWithContext(healthCtx, "GET", platformURL+"/healthz", nil)
	if err == nil {
		healthResp, err := http.DefaultClient.Do(healthReq)
		if err != nil || healthResp.StatusCode != 200 {
			fmt.Println("❌ Lelu platform service is not reachable")
			fmt.Println("")
			fmt.Println("💡 Falling back to local SQLite storage...")
			fmt.Println("   Unset LELU_PLATFORM_URL to use local storage by default")
			fmt.Println("")
			return showAuditLogLocal(limit)
		}
		if healthResp != nil {
			healthResp.Body.Close()
		}
	}

	result, err := client.ListAuditEvents(ctx, &lelu.ListAuditEventsRequest{
		Limit: limit,
	})
	if err != nil {
		return fmt.Errorf("fetch from platform: %w", err)
	}

	displayAuditEvents(result.Events, result.Count, limit, result.NextCursor, "platform")
	return nil
}

func showAuditLogLocal(limit int64) error {
	storage, err := lelu.NewLocalStorage("")
	if err != nil {
		return fmt.Errorf("open local storage: %w", err)
	}
	defer storage.Close()

	fmt.Printf("📂 Using local storage: %s\n\n", storage.GetDBPath())

	result, err := storage.ListAuditEvents(lelu.ListAuditEventsParams{
		Limit: int(limit),
	})
	if err != nil {
		return fmt.Errorf("list audit events: %w", err)
	}

	if len(result.Events) == 0 {
		fmt.Println("📋 No audit events found in local storage.")
		fmt.Println("")
		fmt.Println("This could mean:")
		fmt.Println("- No authorization requests have been logged yet")
		fmt.Println("- Audit events are stored in a remote platform")
		fmt.Println("")
		fmt.Println("💡 To use remote platform:")
		fmt.Println("   LELU_PLATFORM_URL=https://your-platform.com lelu audit-log")
		return nil
	}

	// Convert map events to AuditEvent structs for display
	events := make([]lelu.AuditEvent, len(result.Events))
	for i, e := range result.Events {
		events[i] = mapToAuditEvent(e)
	}

	displayAuditEvents(events, result.Count, limit, result.NextCursor, "local")
	return nil
}

func mapToAuditEvent(m map[string]interface{}) lelu.AuditEvent {
	event := lelu.AuditEvent{}

	if v, ok := m["trace_id"].(string); ok {
		event.TraceID = v
	}
	if v, ok := m["timestamp"].(string); ok {
		event.Timestamp = v
	}
	if v, ok := m["actor"].(string); ok {
		event.Actor = v
	}
	if v, ok := m["action"].(string); ok {
		event.Action = v
	}
	if v, ok := m["decision"].(string); ok {
		event.Decision = v
	}
	if v, ok := m["resource"].(map[string]interface{}); ok {
		resource := make(map[string]string)
		for k, val := range v {
			if str, ok := val.(string); ok {
				resource[k] = str
			}
		}
		event.Resource = resource
	}
	if v, ok := m["confidence_score"].(float64); ok {
		event.ConfidenceScore = &v
	}
	if v, ok := m["reason"].(string); ok {
		event.Reason = &v
	}
	if v, ok := m["downgraded_scope"].(string); ok {
		event.DowngradedScope = &v
	}

	return event
}

func displayAuditEvents(events []lelu.AuditEvent, count int, limit int64, nextCursor int64, source string) {
	fmt.Printf("📊 Audit Log (%d events, limit: %d) [%s]\n", count, limit, source)
	fmt.Println(strings.Repeat("─", 80))

	for _, event := range events {
		timestamp, err := time.Parse(time.RFC3339, event.Timestamp)
		if err != nil {
			timestamp = time.Now()
		}
		formattedTime := timestamp.Format("2006-01-02 15:04:05 UTC")

		confidence := ""
		if event.ConfidenceScore != nil {
			confidence = fmt.Sprintf(" (confidence: %.2f)", *event.ConfidenceScore)
		}

		resource := ""
		if len(event.Resource) > 0 {
			resourceParts := make([]string, 0, len(event.Resource))
			for k, v := range event.Resource {
				resourceParts = append(resourceParts, fmt.Sprintf("%s:%s", k, v))
			}
			resource = fmt.Sprintf(" on {%s}", strings.Join(resourceParts, ", "))
		}

		fmt.Printf("[%s] %s → %s%s\n", formattedTime, event.Actor, event.Action, resource)
		fmt.Printf("  Decision: %s%s\n", event.Decision, confidence)
		if event.Reason != nil {
			fmt.Printf("  Reason: %s\n", *event.Reason)
		}
		if event.DowngradedScope != nil {
			fmt.Printf("  Downgraded scope: %s\n", *event.DowngradedScope)
		}
		fmt.Printf("  Trace ID: %s\n", event.TraceID)
		fmt.Println()
	}

	if nextCursor > 0 {
		fmt.Printf("📄 Use cursor %d to fetch more events.\n", nextCursor)
	}
}

func showPolicies() error {
	platformURL := os.Getenv("LELU_PLATFORM_URL")

	if len(os.Args) < 3 {
		fmt.Println("❌ Policies command is required")
		fmt.Println("")
		fmt.Println("Available commands:")
		fmt.Println("  lelu policies list          List all policies")
		fmt.Println("  lelu policies get <name>    Get a specific policy")
		fmt.Println("  lelu policies set <name> <file>  Create or update a policy")
		fmt.Println("  lelu policies delete <name> Delete a policy")
		return fmt.Errorf("missing policies command")
	}

	subcommand := os.Args[2]

	// Priority: 1. Platform URL, 2. Local SQLite
	if platformURL != "" {
		return showPoliciesPlatform(platformURL, subcommand)
	}
	return showPoliciesLocal(subcommand)
}

func showPoliciesPlatform(platformURL, subcommand string) error {
	apiKey := os.Getenv("LELU_PLATFORM_API_KEY")
	if apiKey == "" {
		apiKey = "platform-dev-key"
	}

	tenantID := os.Getenv("LELU_TENANT_ID")
	if tenantID == "" {
		tenantID = "default"
	}

	fmt.Printf("🌐 Using platform: %s\n\n", platformURL)

	// Check if service is reachable
	ctx := context.Background()
	healthCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	healthReq, err := http.NewRequestWithContext(healthCtx, "GET", platformURL+"/healthz", nil)
	if err == nil {
		healthResp, err := http.DefaultClient.Do(healthReq)
		if err != nil || healthResp.StatusCode != 200 {
			fmt.Println("❌ Lelu platform service is not reachable")
			fmt.Println("")
			fmt.Println("💡 Falling back to local SQLite storage...")
			fmt.Println("   Unset LELU_PLATFORM_URL to use local storage by default")
			fmt.Println("")
			return showPoliciesLocal(subcommand)
		}
		if healthResp != nil {
			healthResp.Body.Close()
		}
	}

	client := lelu.NewClient(lelu.ClientConfig{
		BaseURL: platformURL,
		APIKey:  apiKey,
		Timeout: 10 * time.Second,
	})

	switch subcommand {
	case "list":
		return listPoliciesPlatform(ctx, client, tenantID)
	case "get":
		if len(os.Args) < 4 {
			fmt.Println("❌ Policy name is required")
			fmt.Println("Usage: lelu policies get <name>")
			return fmt.Errorf("missing policy name")
		}
		return getPolicyPlatform(ctx, client, os.Args[3], tenantID)
	case "set":
		if len(os.Args) < 5 {
			fmt.Println("❌ Policy name and file path are required")
			fmt.Println("Usage: lelu policies set <name> <file>")
			return fmt.Errorf("missing arguments")
		}
		return setPolicyPlatform(ctx, client, os.Args[3], os.Args[4], tenantID)
	case "delete":
		if len(os.Args) < 4 {
			fmt.Println("❌ Policy name is required")
			fmt.Println("Usage: lelu policies delete <name>")
			return fmt.Errorf("missing policy name")
		}
		return deletePolicyPlatform(ctx, client, os.Args[3], tenantID)
	default:
		fmt.Printf("❌ Unknown subcommand: %s\n", subcommand)
		return fmt.Errorf("unknown subcommand")
	}
}

func showPoliciesLocal(subcommand string) error {
	storage, err := lelu.NewLocalStorage("")
	if err != nil {
		return fmt.Errorf("open local storage: %w", err)
	}
	defer storage.Close()

	fmt.Printf("📂 Using local storage: %s\n\n", storage.GetDBPath())

	switch subcommand {
	case "list":
		return listPoliciesLocal(storage)
	case "get":
		if len(os.Args) < 4 {
			fmt.Println("❌ Policy name is required")
			fmt.Println("Usage: lelu policies get <name>")
			return fmt.Errorf("missing policy name")
		}
		return getPolicyLocal(storage, os.Args[3])
	case "set":
		if len(os.Args) < 5 {
			fmt.Println("❌ Policy name and file path are required")
			fmt.Println("Usage: lelu policies set <name> <file>")
			return fmt.Errorf("missing arguments")
		}
		return setPolicyLocal(storage, os.Args[3], os.Args[4])
	case "delete":
		if len(os.Args) < 4 {
			fmt.Println("❌ Policy name is required")
			fmt.Println("Usage: lelu policies delete <name>")
			return fmt.Errorf("missing policy name")
		}
		return deletePolicyLocal(storage, os.Args[3])
	default:
		fmt.Printf("❌ Unknown subcommand: %s\n", subcommand)
		return fmt.Errorf("unknown subcommand")
	}
}

// Platform operations
func listPoliciesPlatform(ctx context.Context, client *lelu.Client, tenantID string) error {
	result, err := client.ListPolicies(ctx, &lelu.ListPoliciesRequest{TenantID: tenantID})
	if err != nil {
		return err
	}
	displayPoliciesList(result.Policies, result.Count, "platform")
	return nil
}

func getPolicyPlatform(ctx context.Context, client *lelu.Client, name, tenantID string) error {
	policy, err := client.GetPolicy(ctx, &lelu.GetPolicyRequest{Name: name, TenantID: tenantID})
	if err != nil {
		return err
	}
	displayPolicyDetail(*policy, "platform")
	return nil
}

func setPolicyPlatform(ctx context.Context, client *lelu.Client, name, filePath, tenantID string) error {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("read file: %w", err)
	}
	_, err = client.UpsertPolicy(ctx, &lelu.UpsertPolicyRequest{
		Name:     name,
		Content:  string(content),
		TenantID: tenantID,
	})
	if err != nil {
		return err
	}
	fmt.Printf("✅ Policy \"%s\" saved to platform\n", name)
	return nil
}

func deletePolicyPlatform(ctx context.Context, client *lelu.Client, name, tenantID string) error {
	result, err := client.DeletePolicy(ctx, &lelu.DeletePolicyRequest{Name: name, TenantID: tenantID})
	if err != nil {
		return err
	}
	if result.Deleted {
		fmt.Printf("✅ Policy \"%s\" deleted from platform\n", name)
	} else {
		fmt.Printf("❌ Failed to delete policy \"%s\"\n", name)
	}
	return nil
}

// Local operations
func listPoliciesLocal(storage *lelu.LocalStorage) error {
	policies, err := storage.ListPolicies("")
	if err != nil {
		return err
	}
	if len(policies) == 0 {
		fmt.Println("📋 No policies found in local storage.")
		fmt.Println("")
		fmt.Println("💡 Add a policy:")
		fmt.Println("   lelu policies set my-policy policy.rego")
		return nil
	}
	displayPoliciesList(policies, len(policies), "local")
	return nil
}

func getPolicyLocal(storage *lelu.LocalStorage, name string) error {
	policy, err := storage.GetPolicy(name, "")
	if err != nil {
		return err
	}
	if policy == nil {
		fmt.Printf("❌ Policy \"%s\" not found\n", name)
		return fmt.Errorf("policy not found")
	}
	displayPolicyDetail(*policy, "local")
	return nil
}

func setPolicyLocal(storage *lelu.LocalStorage, name, filePath string) error {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("read file: %w", err)
	}
	err = storage.UpsertPolicy(name, string(content), "", "")
	if err != nil {
		return err
	}
	fmt.Printf("✅ Policy \"%s\" saved to local storage\n", name)
	return nil
}

func deletePolicyLocal(storage *lelu.LocalStorage, name string) error {
	deleted, err := storage.DeletePolicy(name, "")
	if err != nil {
		return err
	}
	if deleted {
		fmt.Printf("✅ Policy \"%s\" deleted from local storage\n", name)
	} else {
		fmt.Printf("⚠️  Policy \"%s\" not found\n", name)
	}
	return nil
}

// Display helpers
func displayPoliciesList(policies []lelu.Policy, count int, source string) {
	fmt.Printf("📜 Policies (%d total) [%s]\n", count, source)
	fmt.Println(strings.Repeat("─", 80))

	for _, policy := range policies {
		createdAt, _ := time.Parse(time.RFC3339, policy.CreatedAt)
		updatedAt, _ := time.Parse(time.RFC3339, policy.UpdatedAt)

		fmt.Printf("\n%s (v%s)\n", policy.Name, policy.Version)
		fmt.Printf("  Created: %s\n", createdAt.Format("2006-01-02 15:04:05 UTC"))
		fmt.Printf("  Updated: %s\n", updatedAt.Format("2006-01-02 15:04:05 UTC"))
		fmt.Printf("  HMAC: %s...\n", policy.HMACSha256[:16])
	}
}

func displayPolicyDetail(policy lelu.Policy, source string) {
	fmt.Printf("📜 Policy: %s (v%s) [%s]\n", policy.Name, policy.Version, source)
	fmt.Println(strings.Repeat("─", 80))
	fmt.Println(policy.Content)
}

func main() {
	command := "help"
	if len(os.Args) > 1 {
		command = os.Args[1]
	}

	switch command {
	case "help", "-h", "--help":
		printHelp()
	case "audit-log":
		if err := showAuditLog(); err != nil {
			os.Exit(1)
		}
	case "policies":
		if err := showPolicies(); err != nil {
			os.Exit(1)
		}
	default:
		fmt.Printf("Unknown command: %s\n", command)
		printHelp()
		os.Exit(1)
	}
}
