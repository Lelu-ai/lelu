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

// Scoring types and logic live in lib/nhi-scoring.ts (client-safe, no DB imports).
// Import from there directly in Client Components.
