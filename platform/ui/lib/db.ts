import { neon } from "@neondatabase/serverless";

function getSql() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Add it in Vercel → Settings → Environment Variables.");
  return neon(url);
}

// Tagged-template SQL query helper — safe against SQL injection via parameterization
export function db() {
  return getSql();
}

// Run once at cold-start to ensure tables exist.
// Neon is serverless so CREATE TABLE IF NOT EXISTS is cheap.
export async function ensureSchema() {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS lelu_users (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      email          TEXT UNIQUE NOT NULL,
      password_hash  TEXT NOT NULL,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS lelu_email_tokens (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES lelu_users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_lelu_users_email ON lelu_users (email)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS lelu_api_keys (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL REFERENCES lelu_users(id) ON DELETE CASCADE,
      name         TEXT NOT NULL,
      key_prefix   TEXT NOT NULL,
      key_hash     TEXT NOT NULL UNIQUE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ,
      expires_at   TIMESTAMPTZ,
      revoked      BOOLEAN NOT NULL DEFAULT FALSE,
      revoked_at   TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_lelu_api_keys_user ON lelu_api_keys (user_id, revoked)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_lelu_api_keys_hash ON lelu_api_keys (key_hash)
  `;
}
