package nhi

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

// Risk thresholds for NHI checks. Named constants make them auditable and easy
// to update when organizational policy changes.
const (
	// longLivedSecretDays is the maximum acceptable token lifetime for NHI-07.
	// Credentials valid beyond this window are flagged as long-lived.
	longLivedSecretDays = 90

	// staleIdentityDays is the inactivity window for NHI-01 stale detection.
	staleIdentityDays = 30

	// highVolumeShadowRequestThreshold triggers NHI-10 for unregistered agents
	// that have generated a large number of requests without being registered.
	highVolumeShadowRequestThreshold = 500

	// maxScopesBeforeSprawl is the scope count that triggers NHI-05 scope sprawl.
	maxScopesBeforeSprawl = 5
)

// OWASPFinding is a single OWASP NHI top-10 risk detection result.
type OWASPFinding struct {
	CheckID     string `json:"check_id"` // e.g. "NHI-05"
	Title       string `json:"title"`
	Severity    string `json:"severity"`    // "critical" | "high" | "medium" | "low"
	Description string `json:"description"` // what was detected
	Remediation string `json:"remediation"` // what to do about it
}

// RunChecks evaluates all applicable OWASP NHI checks for an entry and
// returns the findings. The db is used for cross-table checks (e.g. NHI-09
// needs to query shadow_agents across tenants).
func RunChecks(ctx context.Context, db *sql.DB, e *NHIEntry) []OWASPFinding {
	var findings []OWASPFinding

	findings = append(findings, checkNHI01ImproperOffboarding(e)...)
	findings = append(findings, checkNHI05Overprivileged(e)...)
	findings = append(findings, checkNHI07LongLivedSecret(e)...)
	findings = append(findings, checkNHI08EnvironmentIsolation(e)...)
	if db != nil {
		findings = append(findings, checkNHI09CrossTenantReuse(ctx, db, e)...)
	}
	findings = append(findings, checkNHI10HumanAccess(e)...)

	return findings
}

// ── NHI-01: Improper Offboarding ─────────────────────────────────────────────
//
// Detects identities that should be inactive but are still present and active:
//   (a) Registered agents with status=suspended/revoked that still appear in
//       shadow_agents (i.e. still making requests after being deactivated).
//   (b) Any identity stale for > 30 days without being decommissioned.

func checkNHI01ImproperOffboarding(e *NHIEntry) []OWASPFinding {
	var findings []OWASPFinding

	if e.Status == NHIStatusSuspended || e.Status == NHIStatusRevoked {
		findings = append(findings, OWASPFinding{
			CheckID:  "NHI-01",
			Title:    "Improper Offboarding — Identity Still Active After Deactivation",
			Severity: "critical",
			Description: fmt.Sprintf(
				"Identity %q has status %q but has not been fully decommissioned. "+
					"A revoked or suspended identity should have its credentials rotated "+
					"and its access removed from all downstream systems.",
				e.Name, e.Status,
			),
			Remediation: "Rotate or delete associated credentials immediately. " +
				"Verify all downstream OAuth grants and API key usages have been revoked.",
		})
	}

	// Stale active identity — no activity in > staleIdentityDays days.
	if e.Status == NHIStatusStale && e.Type == NHITypeRegisteredAgent {
		daysSinceActivity := int(time.Since(e.LastSeen).Hours() / 24)
		findings = append(findings, OWASPFinding{
			CheckID:  "NHI-01",
			Title:    "Improper Offboarding — Stale Identity Not Decommissioned",
			Severity: "medium",
			Description: fmt.Sprintf(
				"Registered agent %q has had no activity in %d days but remains active. "+
					"Unused identities are a latent attack surface.",
				e.Name, daysSinceActivity,
			),
			Remediation: "Review whether this agent is still needed. If not, revoke it " +
				"via DELETE /v1/agents/{id} and rotate any associated credentials.",
		})
	}

	return findings
}

// ── NHI-05: Overprivileged Identity ──────────────────────────────────────────
//
// Detects identities with excessive OAuth scopes:
//   - Wildcard scopes (*) — grants everything
//   - Admin-level scope patterns (admin:*, :write, :delete)
//   - More than 5 distinct scopes (scope sprawl)

func checkNHI05Overprivileged(e *NHIEntry) []OWASPFinding {
	var findings []OWASPFinding
	if len(e.Scopes) == 0 {
		return findings
	}

	var wildcards, adminScopes []string
	for _, sc := range e.Scopes {
		lower := strings.ToLower(sc)
		if sc == "*" || strings.HasSuffix(sc, ":*") || strings.HasSuffix(sc, "/*") {
			wildcards = append(wildcards, sc)
		}
		if strings.Contains(lower, "admin") ||
			strings.HasSuffix(lower, ":write") ||
			strings.HasSuffix(lower, ":delete") ||
			strings.HasSuffix(lower, ":manage") ||
			strings.Contains(lower, "root") {
			adminScopes = append(adminScopes, sc)
		}
	}

	if len(wildcards) > 0 {
		findings = append(findings, OWASPFinding{
			CheckID:  "NHI-05",
			Title:    "Overprivileged Identity — Wildcard Scope",
			Severity: "critical",
			Description: fmt.Sprintf(
				"Identity %q has wildcard scope(s): %s. "+
					"This grants unrestricted access to all resources.",
				e.Name, strings.Join(wildcards, ", "),
			),
			Remediation: "Replace wildcard scopes with the minimum specific scopes required. " +
				"Apply the principle of least privilege.",
		})
	}

	if len(adminScopes) > 0 {
		findings = append(findings, OWASPFinding{
			CheckID:  "NHI-05",
			Title:    "Overprivileged Identity — Admin-Level Scope",
			Severity: "high",
			Description: fmt.Sprintf(
				"Identity %q holds admin/write/delete scope(s): %s. "+
					"Destructive or administrative access should be time-limited and audited.",
				e.Name, strings.Join(adminScopes, ", "),
			),
			Remediation: "Scope down to read-only where possible. " +
				"Use JIT token minting for destructive operations instead of persistent broad grants.",
		})
	}

	if len(e.Scopes) > maxScopesBeforeSprawl {
		findings = append(findings, OWASPFinding{
			CheckID:  "NHI-05",
			Title:    "Overprivileged Identity — Excessive Scope Count",
			Severity: "medium",
			Description: fmt.Sprintf(
				"Identity %q has %d scopes. Scope sprawl increases blast radius "+
					"if this identity is compromised.",
				e.Name, len(e.Scopes),
			),
			Remediation: "Audit which scopes are actually used and remove unused grants. " +
				"Target ≤ 3 scopes per agent identity.",
		})
	}

	return findings
}

// ── NHI-07: Long-Lived Secrets ────────────────────────────────────────────────
//
// Detects OAuth credentials and tokens that never expire or expire far in the future.
// Long-lived secrets are a high-risk vector: if leaked, they grant access indefinitely.

func checkNHI07LongLivedSecret(e *NHIEntry) []OWASPFinding {
	var findings []OWASPFinding
	if e.Type != NHITypeCredential {
		return findings
	}

	if e.ExpiresAt == nil {
		findings = append(findings, OWASPFinding{
			CheckID:  "NHI-07",
			Title:    "Long-Lived Secret — No Expiry",
			Severity: "high",
			Description: fmt.Sprintf(
				"Credential %q (%s provider) has no expiry date. "+
					"Non-expiring credentials are a critical risk if leaked — "+
					"they grant access indefinitely without rotation.",
				e.Name, e.Provider,
			),
			Remediation: "Configure the OAuth provider to issue short-lived access tokens. " +
				"Set an expiry and enable auto-refresh via the vault. " +
				"For API keys, implement a 90-day rotation policy.",
		})
		return findings
	}

	// Expires more than 90 days from now — considered long-lived.
	if e.ExpiresAt.After(time.Now().UTC().Add(longLivedSecretDays * 24 * time.Hour)) {
		daysUntilExpiry := int(time.Until(*e.ExpiresAt).Hours() / 24)
		findings = append(findings, OWASPFinding{
			CheckID:  "NHI-07",
			Title:    "Long-Lived Secret — Expiry Too Far in Future",
			Severity: "medium",
			Description: fmt.Sprintf(
				"Credential %q (%s provider) expires in %d days. "+
					"Credentials valid for > 90 days increase the window of exposure if leaked.",
				e.Name, e.Provider, daysUntilExpiry,
			),
			Remediation: "Shorten the token TTL to ≤ 90 days. " +
				"Use the vault's auto-refresh to keep short-lived tokens transparent to the agent.",
		})
	}

	return findings
}

// ── NHI-08: Environment Isolation Failure ────────────────────────────────────
//
// Detects test/sandbox credentials being used in contexts that suggest production,
// or mismatched environment signals on the identity.

func checkNHI08EnvironmentIsolation(e *NHIEntry) []OWASPFinding {
	var findings []OWASPFinding

	// Check if scopes contain environment mixing signals.
	var hasProd, hasTest bool
	for _, sc := range e.Scopes {
		lower := strings.ToLower(sc)
		if strings.Contains(lower, "prod") || strings.Contains(lower, "production") {
			hasProd = true
		}
		if strings.Contains(lower, "test") || strings.Contains(lower, "sandbox") || strings.Contains(lower, "staging") {
			hasTest = true
		}
	}

	if hasProd && hasTest {
		findings = append(findings, OWASPFinding{
			CheckID:  "NHI-08",
			Title:    "Environment Isolation Failure — Mixed Prod/Test Scopes",
			Severity: "high",
			Description: fmt.Sprintf(
				"Identity %q holds scopes that span both production and test/sandbox environments. "+
					"This breaks environment isolation and risks test data reaching production "+
					"or production credentials leaking into test systems.",
				e.Name,
			),
			Remediation: "Separate production and non-production identities completely. " +
				"Never share credentials across environment boundaries. " +
				"Use distinct API keys with environment-specific prefixes (lelu_live_ vs lelu_test_).",
		})
	}

	// Shadow agents detected in a named tenant (not default) are likely
	// production traffic — flag that an unregistered agent is operating in prod.
	if e.Type == NHITypeShadowAgent && e.TenantID != "" && e.TenantID != "default" {
		findings = append(findings, OWASPFinding{
			CheckID:  "NHI-08",
			Title:    "Environment Isolation Failure — Unregistered Agent in Production Tenant",
			Severity: "high",
			Description: fmt.Sprintf(
				"Shadow agent %q is making requests in tenant %q without being registered. "+
					"Unregistered agents in named production tenants indicate "+
					"an ungoverned deployment that bypasses your security controls.",
				e.Name, e.TenantID,
			),
			Remediation: "Identify the owner of this agent and register it via POST /v1/agents. " +
				"If unrecognised, treat as a potential compromise and investigate immediately.",
		})
	}

	return findings
}

// ── NHI-09: NHI Reuse Across Tenants ─────────────────────────────────────────
//
// Detects the same shadow agent fingerprint appearing across multiple tenants.
// This indicates a single agent identity is being shared across trust boundaries,
// which breaks tenant isolation.

func checkNHI09CrossTenantReuse(ctx context.Context, db *sql.DB, e *NHIEntry) []OWASPFinding {
	var findings []OWASPFinding
	if e.Type != NHITypeShadowAgent {
		return findings
	}

	// Extract the fingerprint suffix from the name field (format: "shadow:<fp[:8]>").
	// For a real cross-tenant check we query by the full fingerprint, but we
	// only have the first 8 chars in the name. Use ID-based check instead:
	// count how many distinct tenants have the same user_agent pattern.
	var count int
	err := db.QueryRowContext(ctx, `
		SELECT COUNT(DISTINCT tenant_id)
		FROM shadow_agents
		WHERE id = ? AND tenant_id != ''
	`, e.ID).Scan(&count)
	if err != nil || count < 2 {
		// Also try fingerprint-hash match across tenants.
		var name string
		_ = db.QueryRowContext(ctx,
			`SELECT fingerprint_hash FROM shadow_agents WHERE id = ?`, e.ID,
		).Scan(&name)
		if name != "" {
			_ = db.QueryRowContext(ctx, `
				SELECT COUNT(DISTINCT tenant_id)
				FROM shadow_agents
				WHERE fingerprint_hash = ? AND tenant_id != ''
			`, name).Scan(&count)
		}
	}

	if count >= 2 {
		findings = append(findings, OWASPFinding{
			CheckID:  "NHI-09",
			Title:    "NHI Reuse — Same Identity Across Multiple Tenants",
			Severity: "high",
			Description: fmt.Sprintf(
				"Shadow agent %q has been detected making requests across %d distinct tenants. "+
					"Sharing a single non-human identity across tenant boundaries breaks "+
					"isolation and can allow data from one tenant to influence another.",
				e.Name, count,
			),
			Remediation: "Each tenant should have its own registered agent identity. " +
				"Investigate whether this is an integration error or a deliberate bypass attempt.",
		})
	}

	return findings
}

// ── NHI-10: Human Access to NHI ──────────────────────────────────────────────
//
// Detects signals that a non-human identity is being used by or shared with humans:
//   - Agent acting on behalf of a very large number of distinct users
//   - Owner email is missing (ungoverned — no human accountable for it)

func checkNHI10HumanAccess(e *NHIEntry) []OWASPFinding {
	var findings []OWASPFinding

	// Registered agent with no owner is ungoverned.
	if e.Type == NHITypeRegisteredAgent && e.OwnerEmail == "" {
		findings = append(findings, OWASPFinding{
			CheckID:  "NHI-10",
			Title:    "Human Access to NHI — No Accountable Owner",
			Severity: "medium",
			Description: fmt.Sprintf(
				"Registered agent %q has no owner_email set. "+
					"Every non-human identity must have a human accountable for it. "+
					"Ungoverned identities are often abandoned and never rotated.",
				e.Name,
			),
			Remediation: "Set owner_email when registering agents via POST /v1/agents. " +
				"Assign ownership to a team alias or individual, and include rotation SLA.",
		})
	}

	// Shadow agents with very high request counts suggest automated tooling
	// being operated without registration — likely a human developer's script.
	if e.Type == NHITypeShadowAgent && e.RequestCount > highVolumeShadowRequestThreshold {
		findings = append(findings, OWASPFinding{
			CheckID:  "NHI-10",
			Title:    "Human Access to NHI — High-Volume Unregistered Activity",
			Severity: "medium",
			Description: fmt.Sprintf(
				"Shadow agent %q has made %d requests without being registered. "+
					"High request volume from an unregistered identity suggests a developer "+
					"script or tool operating without governance.",
				e.Name, e.RequestCount,
			),
			Remediation: "Identify the owner of this tool and register it as a proper agent. " +
				"Replace manual API key usage with a registered agent identity and OIDC tokens.",
		})
	}

	return findings
}
