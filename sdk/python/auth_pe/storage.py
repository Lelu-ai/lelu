"""Local SQLite storage for audit logs and policies."""

from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from typing import Any

from .models import AuditEvent, Policy, PolicyRule


class LocalStorage:
    """
    SQLite-backed local storage for audit logs and policies.
    Automatically creates ~/.lelu/lelu.db on first use.
    """

    def __init__(self, db_path: str | None = None):
        if db_path is None:
            lelu_dir = Path.home() / ".lelu"
            lelu_dir.mkdir(parents=True, exist_ok=True)
            db_path = str(lelu_dir / "lelu.db")

        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self._initialize()

    def _initialize(self) -> None:
        self.conn.executescript(
            """
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
            """
        )
        self.conn.commit()

    # ─── Audit Events ─────────────────────────────────────────────────────────

    def insert_audit_event(self, event: dict[str, Any]) -> None:
        cursor = self.conn.cursor()
        cursor.execute(
            """
            INSERT INTO audit_events (
                trace_id, user_id, key_id, actor, action, decision,
                reason, rule, policy_name, confidence, latency_ms, mode
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event["trace_id"],
                event.get("user_id"),
                event.get("key_id"),
                event["actor"],
                event["action"],
                event["decision"],
                event.get("reason", ""),
                event.get("rule", ""),
                event.get("policy_name"),
                event.get("confidence", 1.0),
                event.get("latency_ms", 0),
                event.get("mode", "live"),
            ),
        )
        self.conn.commit()

    def list_audit_events(
        self,
        limit: int = 20,
        cursor: int = 0,
        actor: str | None = None,
    ) -> dict[str, Any]:
        query = "SELECT * FROM audit_events WHERE id > ?"
        params: list[Any] = [cursor]

        if actor:
            query += " AND actor = ?"
            params.append(actor)

        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)

        db_cursor = self.conn.cursor()
        db_cursor.execute(query, params)
        rows = db_cursor.fetchall()

        events = []
        for row in rows:
            events.append({
                "id": row["id"],
                "trace_id": row["trace_id"],
                "user_id": row["user_id"],
                "key_id": row["key_id"],
                "actor": row["actor"],
                "action": row["action"],
                "decision": row["decision"],
                "reason": row["reason"],
                "rule": row["rule"],
                "policy_name": row["policy_name"],
                "confidence": row["confidence"],
                "latency_ms": row["latency_ms"],
                "mode": row["mode"],
                "created_at": row["created_at"],
            })

        next_cursor = events[-1]["id"] if events else cursor
        db_cursor.execute("SELECT COUNT(*) as count FROM audit_events")
        count = (db_cursor.fetchone() or {})["count"] if True else 0

        return {"events": events, "count": count, "next_cursor": next_cursor}

    # ─── Policies ─────────────────────────────────────────────────────────────

    def list_policies(self) -> list[dict[str, Any]]:
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM policies ORDER BY name")
        return [_row_to_policy_dict(row) for row in cursor.fetchall()]

    def get_policy(self, policy_id: str) -> dict[str, Any] | None:
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM policies WHERE id = ?", (policy_id,))
        row = cursor.fetchone()
        return _row_to_policy_dict(row) if row else None

    def upsert_policy(
        self,
        name: str,
        rules: list[dict[str, Any]],
        description: str = "",
        is_active: bool = True,
        user_id: str = "",
    ) -> None:
        policy_id = f"{int(time.time() * 1000)}-{abs(hash(name)) % 1_000_000}"
        cursor = self.conn.cursor()
        cursor.execute(
            """
            INSERT INTO policies (id, user_id, name, description, rules, is_active, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(name) DO UPDATE SET
                description = excluded.description,
                rules = excluded.rules,
                is_active = excluded.is_active,
                updated_at = CURRENT_TIMESTAMP
            """,
            (policy_id, user_id, name, description, json.dumps(rules), 1 if is_active else 0),
        )
        self.conn.commit()

    def delete_policy(self, policy_id: str) -> bool:
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM policies WHERE id = ?", (policy_id,))
        self.conn.commit()
        return cursor.rowcount > 0

    # ─── Utilities ────────────────────────────────────────────────────────────

    def close(self) -> None:
        self.conn.close()

    def get_db_path(self) -> str:
        return self.db_path

    def __enter__(self) -> "LocalStorage":
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self.close()


def _row_to_policy_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "name": row["name"],
        "description": row["description"],
        "rules": json.loads(row["rules"]),
        "is_active": bool(row["is_active"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }
