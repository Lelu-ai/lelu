import { createHash, randomBytes } from "crypto";
import { db, ensureSchema } from "./db";

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revoked: boolean;
  revokedAt: string | null;
}

export interface CreateApiKeyResult {
  key: ApiKey;
  fullKey: string; // only returned at creation — never stored plaintext
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// Format: lelu_sk_<12-hex-prefix>_<43-char-base64url-secret>
// Total length: ~64 chars. Prefix is stored plaintext for display; secret is hashed.
// Pass expiresInDays to make the key expire; omit it for a non-expiring key.
export async function createApiKey(
  userId: string,
  name: string,
  expiresInDays?: number
): Promise<CreateApiKeyResult> {
  await ensureSchema();
  const sql = db();

  const prefix = randomBytes(6).toString("hex"); // 12 hex chars
  const secret = randomBytes(32).toString("base64url"); // 43 chars
  const fullKey = `lelu_sk_${prefix}_${secret}`;
  const keyHash = hashKey(fullKey);
  const id = randomBytes(16).toString("hex");

  const expiresAt =
    expiresInDays && expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

  await sql`
    INSERT INTO lelu_api_keys (id, user_id, name, key_prefix, key_hash, created_at, expires_at)
    VALUES (${id}, ${userId}, ${name}, ${prefix}, ${keyHash}, NOW(), ${expiresAt})
  `;

  return {
    key: {
      id,
      userId,
      name,
      keyPrefix: prefix,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      revoked: false,
      revokedAt: null,
    },
    fullKey,
  };
}

export async function listApiKeys(userId: string): Promise<ApiKey[]> {
  await ensureSchema();
  const sql = db();
  const rows = await sql`
    SELECT id, user_id, name, key_prefix, created_at, last_used_at,
           expires_at, revoked, revoked_at
    FROM lelu_api_keys
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return rows.map(rowToKey);
}

// Returns true only if a matching, not-already-revoked key belonging to the
// user was actually revoked; false if nothing matched.
export async function revokeApiKey(id: string, userId: string): Promise<boolean> {
  const sql = db();
  const result = await sql`
    UPDATE lelu_api_keys
    SET revoked = TRUE, revoked_at = NOW()
    WHERE id = ${id} AND user_id = ${userId} AND revoked = FALSE
  `;
  return result.count > 0;
}

// Validates an incoming API key for the public /api/v1/* routes.
export async function validateApiKey(
  fullKey: string
): Promise<{ userId: string; keyId: string } | null> {
  const sql = db();
  const keyHash = hashKey(fullKey);
  const rows = await sql`
    SELECT id, user_id, expires_at, revoked
    FROM lelu_api_keys
    WHERE key_hash = ${keyHash}
  `;
  if (rows.length === 0) return null;

  const row = rows[0];
  if (row.revoked) return null;
  if (row.expires_at && new Date(row.expires_at as string) < new Date()) return null;

  await sql`UPDATE lelu_api_keys SET last_used_at = NOW() WHERE id = ${row.id}`;

  return { userId: row.user_id as string, keyId: row.id as string };
}

function rowToKey(r: Record<string, unknown>): ApiKey {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    name: r.name as string,
    keyPrefix: r.key_prefix as string,
    createdAt: r.created_at as string,
    lastUsedAt: (r.last_used_at as string) ?? null,
    expiresAt: (r.expires_at as string) ?? null,
    revoked: r.revoked as boolean,
    revokedAt: (r.revoked_at as string) ?? null,
  };
}
