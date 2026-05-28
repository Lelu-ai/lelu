import Database from "better-sqlite3";
import { homedir } from "os";
import { join } from "path";
import { mkdirSync, existsSync } from "fs";
import type { AuditEvent, Policy, PolicyRule } from "./types.js";

// ─── Local Storage with SQLite ────────────────────────────────────────────────

/**
 * LocalStorage provides SQLite-based local storage for audit logs and policies.
 * Automatically creates ~/.lelu/lelu.db on first use.
 */
export class LocalStorage {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    if (!dbPath) {
      const leluDir = join(homedir(), ".lelu");
      if (!existsSync(leluDir)) {
        mkdirSync(leluDir, { recursive: true });
      }
      dbPath = join(leluDir, "lelu.db");
    }

    this.dbPath = dbPath;
    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trace_id TEXT NOT NULL,
        user_id TEXT,
        key_id TEXT,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        decision TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT '',
        rule TEXT NOT NULL DEFAULT '',
        policy_name TEXT,
        confidence REAL NOT NULL DEFAULT 1.0,
        latency_ms INTEGER NOT NULL DEFAULT 0,
        mode TEXT NOT NULL DEFAULT 'live',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_audit_trace ON audit_events(trace_id);
      CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_events(actor, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at DESC);

      CREATE TABLE IF NOT EXISTS policies (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL DEFAULT '',
        rules TEXT NOT NULL DEFAULT '[]',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  // ─── Audit Events ─────────────────────────────────────────────────────────

  insertAuditEvent(event: Omit<AuditEvent, "id">): void {
    const stmt = this.db.prepare(`
      INSERT INTO audit_events (
        trace_id, user_id, key_id, actor, action, decision,
        reason, rule, policy_name, confidence, latency_ms, mode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.traceId,
      event.userId ?? null,
      event.keyId ?? null,
      event.actor,
      event.action,
      event.decision,
      event.reason,
      event.rule,
      event.policyName ?? null,
      event.confidence,
      event.latencyMs,
      event.mode
    );
  }

  listAuditEvents(params: {
    limit?: number;
    cursor?: number;
    actor?: string;
  }): { events: AuditEvent[]; count: number; nextCursor: number } {
    const limit = params.limit || 20;
    const cursor = params.cursor || 0;

    let query = `SELECT * FROM audit_events WHERE id > ?`;
    const queryParams: unknown[] = [cursor];

    if (params.actor) {
      query += ` AND actor = ?`;
      queryParams.push(params.actor);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    queryParams.push(limit);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...queryParams) as Record<string, unknown>[];

    const events: AuditEvent[] = rows.map((row) => ({
      id: row["id"] as number,
      traceId: row["trace_id"] as string,
      ...(row["user_id"] != null ? { userId: row["user_id"] as string } : {}),
      ...(row["key_id"] != null ? { keyId: row["key_id"] as string } : {}),
      actor: row["actor"] as string,
      action: row["action"] as string,
      decision: row["decision"] as "allowed" | "denied" | "human_review",
      reason: row["reason"] as string,
      rule: row["rule"] as string,
      ...(row["policy_name"] != null ? { policyName: row["policy_name"] as string } : {}),
      confidence: row["confidence"] as number,
      latencyMs: row["latency_ms"] as number,
      mode: row["mode"] as string,
      createdAt: row["created_at"] as string,
    }));

    const nextCursor =
      events.length > 0 ? (events[events.length - 1]?.id ?? cursor) : cursor;
    const countStmt = this.db.prepare("SELECT COUNT(*) as count FROM audit_events");
    const countResult = countStmt.get() as { count: number };

    return { events, count: countResult.count, nextCursor };
  }

  // ─── Policies ─────────────────────────────────────────────────────────────

  listPolicies(): Policy[] {
    const stmt = this.db.prepare("SELECT * FROM policies ORDER BY name");
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map(rowToPolicy);
  }

  getPolicy(id: string): Policy | null {
    const stmt = this.db.prepare("SELECT * FROM policies WHERE id = ?");
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? rowToPolicy(row) : null;
  }

  upsertPolicy(policy: {
    name: string;
    description?: string;
    rules: PolicyRule[];
    isActive?: boolean;
    userId?: string;
  }): void {
    const id = this.generateId();
    const stmt = this.db.prepare(`
      INSERT INTO policies (id, user_id, name, description, rules, is_active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(name) DO UPDATE SET
        description = excluded.description,
        rules = excluded.rules,
        is_active = excluded.is_active,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      id,
      policy.userId ?? "",
      policy.name,
      policy.description ?? "",
      JSON.stringify(policy.rules),
      policy.isActive !== false ? 1 : 0
    );
  }

  deletePolicy(id: string): boolean {
    const stmt = this.db.prepare("DELETE FROM policies WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  close(): void {
    this.db.close();
  }

  getDbPath(): string {
    return this.dbPath;
  }
}

function rowToPolicy(row: Record<string, unknown>): Policy {
  return {
    id: row["id"] as string,
    userId: row["user_id"] as string,
    name: row["name"] as string,
    description: row["description"] as string,
    rules: JSON.parse(row["rules"] as string) as PolicyRule[],
    isActive: row["is_active"] === 1,
    createdAt: row["created_at"] as string,
    updatedAt: row["updated_at"] as string,
  };
}
