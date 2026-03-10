package main

import (
	"context"
	"fmt"
	"io"
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
  lelu audit-log         View recent audit events from the platform
  lelu policies          Manage authorization policies
  lelu help              Show this help

Commands:
  audit-log              View audit trail and authorization events
  policies list          List all policies
  policies get <name>    Get a specific policy
  policies set <name> <file>  Create or update a policy from file
  policies delete <name> Delete a policy

Environment Variables:
  LELU_PLATFORM_URL       Platform API URL (default: http://localhost:9091)
  LELU_PLATFORM_API_KEY   Platform API key (default: platform-dev-key)
  LELU_TENANT_ID          Tenant ID (default: default)
  LELU_AUDIT_LIMIT        Number of events to fetch (default: 20)

Examples:
  lelu audit-log                              # View recent audit events
  lelu policies list                          # List all policies
  lelu policies get auth                      # View the "auth" policy
  lelu policies set auth ./auth.rego          # Create/update policy from file
  LELU_TENANT_ID=prod lelu policies list      # Use different tenant
`)
}

func showAuditLog() error {
	baseURL := os.Getenv("LELU_PLATFORM_URL")
	if baseURL == "" {
		baseURL = "http://localhost:9091"
	}

	apiKey := os.Getenv("LELU_PLATFORM_API_KEY")
	if apiKey == "" {
		apiKey = "platform-dev-key"
	}

	limitStr := os.Getenv("LELU_AUDIT_LIMIT")
	if limitStr == "" {
		limitStr = "20"
	}
	limit, err := strconv.ParseInt(limitStr, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid LELU_AUDIT_LIMIT: %w", err)
	}

	fmt.Printf("Fetching audit log from %s...\n", baseURL)

	client := lelu.NewClient(lelu.ClientConfig{
		BaseURL: baseURL,
		APIKey:  apiKey,
		Timeout: 10 * time.Second,
	})

	ctx := context.Background()
	
	// First check if the service is reachable
	healthCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	
	healthReq, err := http.NewRequestWithContext(healthCtx, "GET", baseURL+"/healthz", nil)
	if err == nil {
		healthResp, err := http.DefaultClient.Do(healthReq)
		if err != nil || healthResp.StatusCode != 200 {
			fmt.Println("❌ Lelu platform service is not running or not reachable")
			fmt.Println("")
			fmt.Println("To view audit logs, you need the Lelu platform service running.")
			fmt.Println("")
			fmt.Println("🚀 Quick start with Docker:")
			fmt.Println("  git clone https://github.com/lelu-auth/lelu.git")
			fmt.Println("  cd lelu")
			fmt.Println("  docker compose up -d")
			fmt.Println("  lelu audit-log  # Try again")
			fmt.Println("")
			fmt.Println("🌐 Or set LELU_PLATFORM_URL to point to your hosted instance:")
			fmt.Println("  LELU_PLATFORM_URL=https://your-lelu-platform.com lelu audit-log")
			fmt.Println("")
			fmt.Printf("💡 Currently trying to connect to: %s\n", baseURL)
			return fmt.Errorf("platform service not available")
		}
		if healthResp != nil {
			healthResp.Body.Close()
		}
	}

	result, err := client.ListAuditEvents(ctx, &lelu.ListAuditEventsRequest{
		Limit: limit,
	})
	if err != nil {
		if strings.Contains(err.Error(), "connection refused") || strings.Contains(err.Error(), "no such host") {
			fmt.Println("❌ Connection failed to Lelu platform service")
			fmt.Println("")
			fmt.Println("🔧 Troubleshooting steps:")
			fmt.Println("1. Ensure the Lelu platform service is running")
			fmt.Println("2. Check the platform URL is correct")
			fmt.Println("3. Verify your network connection")
			fmt.Println("4. Check if firewall is blocking the connection")
		} else {
			fmt.Printf("❌ Error fetching audit log: %v\n", err)
		}
		return err
	}

	if len(result.Events) == 0 {
		fmt.Println("📋 No audit events found.")
		fmt.Println("")
		fmt.Println("This could mean:")
		fmt.Println("- No authorization requests have been made yet")
		fmt.Println("- The audit data is stored elsewhere")
		fmt.Println("- Filters are too restrictive")
		return nil
	}

	fmt.Printf("\n📊 Audit Log (%d events, limit: %d)\n", result.Count, limit)
	fmt.Println(strings.Repeat("─", 80))

	for _, event := range result.Events {
		// Parse timestamp
		timestamp, err := time.Parse(time.RFC3339, event.Timestamp)
		if err != nil {
			timestamp = time.Now() // fallback
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

	if result.NextCursor > 0 {
		fmt.Printf("📄 Use cursor %d to fetch more events.\n", result.NextCursor)
	}

	return nil
}

func showPolicies() error {
	baseURL := os.Getenv("LELU_PLATFORM_URL")
	if baseURL == "" {
		baseURL = "http://localhost:9091"
	}

	apiKey := os.Getenv("LELU_PLATFORM_API_KEY")
	if apiKey == "" {
		apiKey = "platform-dev-key"
	}

	tenantID := os.Getenv("LELU_TENANT_ID")
	if tenantID == "" {
		tenantID = "default"
	}

	if len(os.Args) < 3 {
		fmt.Println("❌ Policies command is required")
		fmt.Println("Usage: lelu policies <list|get|set|delete> [args...]")
		return fmt.Errorf("missing policies command")
	}

	subcommand := os.Args[2]

	// First check if the service is reachable
	ctx := context.Background()
	healthCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	healthReq, err := http.NewRequestWithContext(healthCtx, "GET", baseURL+"/healthz", nil)
	if err == nil {
		healthResp, err := http.DefaultClient.Do(healthReq)
		if err != nil || healthResp.StatusCode != 200 {
			fmt.Println("❌ Lelu platform service is not running or not reachable")
			fmt.Println("")
			fmt.Println("To manage policies, you need the Lelu platform service running.")
			fmt.Println("")
			fmt.Println("🚀 Quick start with Docker:")
			fmt.Println("  git clone https://github.com/lelu-auth/lelu.git")
			fmt.Println("  cd lelu")
			fmt.Println("  docker compose up -d")
			fmt.Println("  lelu policies list  # Try again")
			fmt.Println("")
			fmt.Println("🌐 Or set LELU_PLATFORM_URL to point to your hosted instance:")
			fmt.Println("  LELU_PLATFORM_URL=https://your-lelu-platform.com lelu policies list")
			fmt.Println("")
			fmt.Printf("💡 Currently trying to connect to: %s\n", baseURL)
			return fmt.Errorf("platform service not available")
		}
		if healthResp != nil {
			healthResp.Body.Close()
		}
	}

	client := lelu.NewClient(lelu.ClientConfig{
		BaseURL: baseURL,
		APIKey:  apiKey,
		Timeout: 10 * time.Second,
	})

	switch subcommand {
	case "list":
		return listPolicies(ctx, client, tenantID)
	case "get":
		if len(os.Args) < 4 {
			fmt.Println("❌ Policy name is required")
			fmt.Println("Usage: lelu policies get <policy-name>")
			return fmt.Errorf("missing policy name")
		}
		policyName := os.Args[3]
		return getPolicy(ctx, client, policyName, tenantID)
	case "set":
		if len(os.Args) < 5 {
			fmt.Println("❌ Policy name and file path are required")
			fmt.Println("Usage: lelu policies set <policy-name> <file-path>")
			return fmt.Errorf("missing policy name or file path")
		}
		policyName := os.Args[3]
		filePath := os.Args[4]
		return setPolicy(ctx, client, policyName, filePath, tenantID)
	case "delete":
		if len(os.Args) < 4 {
			fmt.Println("❌ Policy name is required")
			fmt.Println("Usage: lelu policies delete <policy-name>")
			return fmt.Errorf("missing policy name")
		}
		policyName := os.Args[3]
		return deletePolicy(ctx, client, policyName, tenantID)
	default:
		fmt.Printf("❌ Unknown policies command: %s\n", subcommand)
		fmt.Println("Available commands: list, get, set, delete")
		return fmt.Errorf("unknown policies command")
	}
}

func listPolicies(ctx context.Context, client *lelu.Client, tenantID string) error {
	fmt.Println("Fetching policies...")

	result, err := client.ListPolicies(ctx, &lelu.ListPoliciesRequest{
		TenantID: tenantID,
	})
	if err != nil {
		if strings.Contains(err.Error(), "connection refused") || strings.Contains(err.Error(), "no such host") {
			fmt.Println("❌ Connection failed to Lelu platform service")
			fmt.Println("")
			fmt.Println("🔧 Troubleshooting steps:")
			fmt.Println("1. Ensure the Lelu platform service is running")
			fmt.Println("2. Check the platform URL is correct")
			fmt.Println("3. Verify your network connection")
			fmt.Println("4. Check if firewall is blocking the connection")
		} else {
			fmt.Printf("❌ Error fetching policies: %v\n", err)
		}
		return err
	}

	if len(result.Policies) == 0 {
		fmt.Println("📋 No policies found.")
		fmt.Println("")
		fmt.Println("This could mean:")
		fmt.Println("- No policies have been created yet")
		fmt.Println("- You are looking at the wrong tenant")
		fmt.Println("- The policies are stored elsewhere")
		return nil
	}

	fmt.Printf("\n📊 Policies (%d total)\n", result.Count)
	fmt.Println(strings.Repeat("─", 80))

	for _, policy := range result.Policies {
		// Parse timestamps
		createdAt, _ := time.Parse(time.RFC3339, policy.CreatedAt)
		updatedAt, _ := time.Parse(time.RFC3339, policy.UpdatedAt)

		fmt.Printf("📄 %s (v%s)\n", policy.Name, policy.Version)
		fmt.Printf("  ID: %s\n", policy.ID)
		fmt.Printf("  Created: %s\n", createdAt.Format("2006-01-02 15:04:05 UTC"))
		fmt.Printf("  Updated: %s\n", updatedAt.Format("2006-01-02 15:04:05 UTC"))
		fmt.Printf("  Content: %d characters\n", len(policy.Content))
		fmt.Println()
	}

	return nil
}

func getPolicy(ctx context.Context, client *lelu.Client, name, tenantID string) error {
	fmt.Printf("Fetching policy \"%s\"...\n", name)

	policy, err := client.GetPolicy(ctx, &lelu.GetPolicyRequest{
		Name:     name,
		TenantID: tenantID,
	})
	if err != nil {
		if strings.Contains(err.Error(), "404") || strings.Contains(err.Error(), "not found") {
			fmt.Printf("❌ Policy \"%s\" not found\n", name)
			fmt.Println("")
			fmt.Println("💡 Use \"lelu policies list\" to see available policies")
			return err
		}
		fmt.Printf("❌ Error fetching policy: %v\n", err)
		return err
	}

	// Parse timestamps
	createdAt, _ := time.Parse(time.RFC3339, policy.CreatedAt)
	updatedAt, _ := time.Parse(time.RFC3339, policy.UpdatedAt)

	fmt.Printf("\n📄 Policy: %s (v%s)\n", policy.Name, policy.Version)
	fmt.Println(strings.Repeat("─", 80))
	fmt.Printf("ID: %s\n", policy.ID)
	fmt.Printf("Tenant: %s\n", policy.TenantID)
	fmt.Printf("Created: %s\n", createdAt.Format("2006-01-02 15:04:05 UTC"))
	fmt.Printf("Updated: %s\n", updatedAt.Format("2006-01-02 15:04:05 UTC"))
	fmt.Printf("HMAC: %s\n", policy.HMACSha256)
	fmt.Println()
	fmt.Println("Content:")
	fmt.Println(strings.Repeat("─", 40))
	fmt.Println(policy.Content)

	return nil
}

func setPolicy(ctx context.Context, client *lelu.Client, name, filePath, tenantID string) error {
	// Read file content
	file, err := os.Open(filePath)
	if err != nil {
		fmt.Printf("❌ Error opening file: %v\n", err)
		return err
	}
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		fmt.Printf("❌ Error reading file: %v\n", err)
		return err
	}

	fmt.Printf("Setting policy \"%s\" from %s...\n", name, filePath)

	policy, err := client.UpsertPolicy(ctx, &lelu.UpsertPolicyRequest{
		Name:     name,
		Content:  string(content),
		TenantID: tenantID,
	})
	if err != nil {
		fmt.Printf("❌ Error setting policy: %v\n", err)
		return err
	}

	// Parse timestamp
	updatedAt, _ := time.Parse(time.RFC3339, policy.UpdatedAt)

	fmt.Printf("✅ Policy \"%s\" saved successfully\n", name)
	fmt.Printf("  ID: %s\n", policy.ID)
	fmt.Printf("  Version: %s\n", policy.Version)
	fmt.Printf("  Updated: %s\n", updatedAt.Format("2006-01-02 15:04:05 UTC"))
	fmt.Printf("  Content: %d characters\n", len(content))

	return nil
}

func deletePolicy(ctx context.Context, client *lelu.Client, name, tenantID string) error {
	fmt.Printf("Deleting policy \"%s\"...\n", name)

	result, err := client.DeletePolicy(ctx, &lelu.DeletePolicyRequest{
		Name:     name,
		TenantID: tenantID,
	})
	if err != nil {
		if strings.Contains(err.Error(), "404") || strings.Contains(err.Error(), "not found") {
			fmt.Printf("❌ Policy \"%s\" not found\n", name)
			fmt.Println("")
			fmt.Println("💡 Use \"lelu policies list\" to see available policies")
			return err
		}
		fmt.Printf("❌ Error deleting policy: %v\n", err)
		return err
	}

	if result.Deleted {
		fmt.Printf("✅ Policy \"%s\" deleted successfully\n", name)
	} else {
		fmt.Printf("❌ Failed to delete policy \"%s\"\n", name)
	}

	return nil
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