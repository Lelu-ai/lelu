// Pure NHI risk-scoring logic — no Node.js imports, safe to use in Client Components.
// DB-dependent functions (listAgents, createAgent, etc.) stay in lib/agents.ts.

export type RiskLevel = "critical" | "high" | "medium" | "low" | "none";

export interface NHIFinding {
  checkId: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  remediation: string;
}

export interface NHIEntry {
  id: string;
  type: "registered_agent" | "api_key";
  name: string;
  status: string;
  scopes: string[];
  riskScore: number;
  riskLevel: RiskLevel;
  findings: NHIFinding[];
  lastSeen: string | null;
  createdAt: string;
  agentType?: string;
  ownerEmail?: string;
  keyPrefix?: string;
  expiresAt?: string | null;
}

type ScoringInput = Omit<NHIEntry, "riskScore" | "riskLevel" | "findings">;

export function scoreNHI(entry: ScoringInput): {
  riskScore: number;
  riskLevel: RiskLevel;
  findings: NHIFinding[];
} {
  const findings: NHIFinding[] = [];

  // NHI-01: Improper offboarding
  if (entry.status === "revoked" || entry.status === "suspended") {
    findings.push({
      checkId: "NHI-01",
      title: "Improper Offboarding",
      severity: "critical",
      description: `Identity "${entry.name}" has status "${entry.status}" but may still have active grants.`,
      remediation: "Rotate all credentials and verify downstream access has been revoked.",
    });
  }
  const lastSeenDate = entry.lastSeen ? new Date(entry.lastSeen) : null;
  const staleDays = lastSeenDate
    ? Math.floor((Date.now() - lastSeenDate.getTime()) / 86_400_000)
    : null;
  if (staleDays !== null && staleDays > 30 && entry.status === "active") {
    findings.push({
      checkId: "NHI-01",
      title: "Stale Identity Not Decommissioned",
      severity: "medium",
      description: `"${entry.name}" has had no activity in ${staleDays} days but remains active.`,
      remediation: "Review whether this identity is still needed. If not, revoke it.",
    });
  }

  // NHI-05: Overprivileged
  const wildcards = entry.scopes.filter(
    (s) => s === "*" || s.endsWith(":*") || s.endsWith("/*")
  );
  const adminScopes = entry.scopes.filter((s) =>
    /admin|:write$|:delete$|:manage$|root/i.test(s)
  );
  if (wildcards.length > 0) {
    findings.push({
      checkId: "NHI-05",
      title: "Overprivileged — Wildcard Scope",
      severity: "critical",
      description: `"${entry.name}" has wildcard scope(s): ${wildcards.join(", ")}.`,
      remediation: "Replace wildcards with minimum specific scopes.",
    });
  }
  if (adminScopes.length > 0) {
    findings.push({
      checkId: "NHI-05",
      title: "Overprivileged — Admin Scope",
      severity: "high",
      description: `"${entry.name}" holds admin/write/delete scope(s): ${adminScopes.join(", ")}.`,
      remediation: "Scope down to read-only where possible.",
    });
  }
  if (entry.scopes.length > 5) {
    findings.push({
      checkId: "NHI-05",
      title: "Scope Sprawl",
      severity: "medium",
      description: `"${entry.name}" has ${entry.scopes.length} scopes — increases blast radius.`,
      remediation: "Audit and remove unused scopes. Target ≤ 3 per identity.",
    });
  }

  // NHI-07: Long-lived secrets (API keys)
  if (entry.type === "api_key" && !entry.expiresAt) {
    findings.push({
      checkId: "NHI-07",
      title: "Long-Lived Secret — No Expiry",
      severity: "high",
      description: `API key "${entry.name}" has no expiry date.`,
      remediation: "Set a maximum 90-day expiry and enable rotation.",
    });
  }

  // NHI-10: No owner
  if (entry.type === "registered_agent" && !entry.ownerEmail) {
    findings.push({
      checkId: "NHI-10",
      title: "No Accountable Owner",
      severity: "medium",
      description: `Agent "${entry.name}" has no owner email set.`,
      remediation: "Assign an owner when registering agents.",
    });
  }

  // Compute score
  const weights: Record<string, number> = {
    critical: 1.0,
    high: 0.7,
    medium: 0.4,
    low: 0.15,
  };
  let total = 0;
  let maxW = 0;
  for (const f of findings) {
    const w = weights[f.severity] ?? 0;
    total += w;
    if (w > maxW) maxW = w;
  }
  let score = findings.length > 0 ? (total / findings.length + maxW) / 2 : 0;
  if (entry.status === "active" && staleDays !== null && staleDays > 30) score += 0.1;
  score = Math.min(1, score);

  const riskLevel: RiskLevel =
    score >= 0.8 ? "critical"
    : score >= 0.55 ? "high"
    : score >= 0.3 ? "medium"
    : score > 0 ? "low"
    : "none";

  return { riskScore: score, riskLevel, findings };
}
