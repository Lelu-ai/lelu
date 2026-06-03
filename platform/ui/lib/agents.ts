import { randomBytes } from "crypto";
import { db, ensureSchema } from "./db";

export type AgentType = "autonomous" | "assistant" | "workflow";
export type AgentStatus = "active" | "suspended" | "revoked";

export interface AgentRow {
  id: string;
  userId: string;
  name: string;
  description: string;
  agentType: AgentType;
  ownerEmail: string;
  status: AgentStatus;
  scopes: string[];
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentInput {
  userId: string;
  name: string;
  description?: string;
  agentType?: AgentType;
  ownerEmail?: string;
  scopes?: string[];
}

export async function listAgents(userId: string): Promise<AgentRow[]> {
  await ensureSchema();
  const sql = db();
  const rows = await sql<AgentRow[]>`
    SELECT
      id, user_id AS "userId", name, description,
      agent_type AS "agentType", owner_email AS "ownerEmail",
      status, scopes,
      last_seen_at AS "lastSeenAt",
      created_at AS "createdAt", updated_at AS "updatedAt"
    FROM lelu_agents
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return rows;
}

export async function getAgent(id: string, userId: string): Promise<AgentRow | null> {
  await ensureSchema();
  const sql = db();
  const [row] = await sql<AgentRow[]>`
    SELECT
      id, user_id AS "userId", name, description,
      agent_type AS "agentType", owner_email AS "ownerEmail",
      status, scopes,
      last_seen_at AS "lastSeenAt",
      created_at AS "createdAt", updated_at AS "updatedAt"
    FROM lelu_agents
    WHERE id = ${id} AND user_id = ${userId}
  `;
  return row ?? null;
}

export async function createAgent(input: CreateAgentInput): Promise<AgentRow> {
  await ensureSchema();
  const sql = db();
  const id = `agent_${randomBytes(10).toString("hex")}`;
  const [row] = await sql<AgentRow[]>`
    INSERT INTO lelu_agents
      (id, user_id, name, description, agent_type, owner_email, scopes)
    VALUES (
      ${id},
      ${input.userId},
      ${input.name},
      ${input.description ?? ""},
      ${input.agentType ?? "autonomous"},
      ${input.ownerEmail ?? ""},
      ${JSON.stringify(input.scopes ?? [])}
    )
    RETURNING
      id, user_id AS "userId", name, description,
      agent_type AS "agentType", owner_email AS "ownerEmail",
      status, scopes,
      last_seen_at AS "lastSeenAt",
      created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  return row;
}

export async function setAgentStatus(
  id: string,
  userId: string,
  status: AgentStatus
): Promise<boolean> {
  await ensureSchema();
  const sql = db();
  const result = await sql`
    UPDATE lelu_agents
    SET status = ${status}, updated_at = NOW()
    WHERE id = ${id} AND user_id = ${userId}
  `;
  return result.count > 0;
}

// Risk scoring helpers used by the NHI page.

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
  // type-specific
  agentType?: string;
  ownerEmail?: string;
  keyPrefix?: string;
  expiresAt?: string | null;
}

export function scoreNHI(entry: Omit<NHIEntry, "riskScore" | "riskLevel" | "findings">): { riskScore: number; riskLevel: RiskLevel; findings: NHIFinding[] } {
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
  const staleDays = lastSeenDate ? Math.floor((Date.now() - lastSeenDate.getTime()) / 86_400_000) : null;
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
  const wildcards = entry.scopes.filter(s => s === "*" || s.endsWith(":*") || s.endsWith("/*"));
  const adminScopes = entry.scopes.filter(s => /admin|:write$|:delete$|:manage$|root/i.test(s));
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
  if (entry.type === "api_key") {
    if (!entry.expiresAt) {
      findings.push({
        checkId: "NHI-07",
        title: "Long-Lived Secret — No Expiry",
        severity: "high",
        description: `API key "${entry.name}" has no expiry date.`,
        remediation: "Set a maximum 90-day expiry and enable rotation.",
      });
    }
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

  // Score
  const weights: Record<string, number> = { critical: 1.0, high: 0.7, medium: 0.4, low: 0.15 };
  let total = 0, maxW = 0;
  for (const f of findings) {
    const w = weights[f.severity] ?? 0;
    total += w;
    if (w > maxW) maxW = w;
  }
  let score = findings.length > 0 ? (total / findings.length + maxW) / 2 : 0;
  if (entry.status === "active" && staleDays !== null && staleDays > 30) score += 0.1;
  score = Math.min(1, score);

  const riskLevel: RiskLevel =
    score >= 0.8 ? "critical" :
    score >= 0.55 ? "high" :
    score >= 0.30 ? "medium" :
    score > 0 ? "low" : "none";

  return { riskScore: score, riskLevel, findings };
}
