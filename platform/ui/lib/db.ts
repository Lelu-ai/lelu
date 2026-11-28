import postgres from "postgres";

// Cached across hot-reloads in dev, one pool per serverless instance in prod.
// Works with any standard Postgres URL:
//   Neon:          postgresql://user:pass@ep-xyz.neon.tech/dbname?sslmode=require
//   GCP Cloud SQL: postgresql://user:pass@34.x.x.x/dbname?sslmode=require
//   Local:         postgresql://postgres@localhost/dbname
let _sql: ReturnType<typeof postgres> | undefined;

export function db(): ReturnType<typeof postgres> {
  if (!_sql) {
    const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Add it in Vercel → Settings → Environment Variables.");
    _sql = postgres(url, {
      max: 5,           // max connections per serverless instance
      idle_timeout: 20, // release idle connections after 20s
      connect_timeout: 10,
    });
  }
  return _sql;
}

// Run the schema setup once per server instance, not on every request. It is
// ~29 statements, several of which take an exclusive lock on lelu_users even
// when there is nothing to change, so running it per request slowed every
// route and made concurrent requests wait on each other. A failure is not
// cached: the next call tries again.
let schemaReady: Promise<void> | undefined;

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = applySchema().catch((err) => {
      schemaReady = undefined;
      throw err;
    });
  }
  return schemaReady;
}

async function applySchema(): Promise<void> {
  const sql = db();

  await sql`
    CREATE TABLE IF NOT EXISTS lelu_users (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      email          TEXT UNIQUE NOT NULL,
      password_hash  TEXT,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at  TIMESTAMPTZ
    )
  `;

  // Backfill for databases created before last_login_at existed.
  await sql`
    ALTER TABLE lelu_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ
  `;

  // Backfill for databases created before plan/quota tiers existed.
  await sql`
    ALTER TABLE lelu_users ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free'
  `;
  await sql`
    ALTER TABLE lelu_users ADD COLUMN IF NOT EXISTS plan_updated_at TIMESTAMPTZ
  `;

  // Backfill for databases created before Stripe billing existed.
  await sql`
    ALTER TABLE lelu_users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_lelu_users_stripe_customer
      ON lelu_users (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL
  `;

  // Provider-neutral billing columns (Paddle today). stripe_customer_id above
  // is kept for accounts created through the Stripe routes. plan_event_at is
  // the timestamp of the last billing event applied, so a retried or
  // out-of-order webhook can never overwrite a newer plan.
  await sql`ALTER TABLE lelu_users ADD COLUMN IF NOT EXISTS billing_provider TEXT`;
  await sql`ALTER TABLE lelu_users ADD COLUMN IF NOT EXISTS billing_customer_id TEXT`;
  await sql`ALTER TABLE lelu_users ADD COLUMN IF NOT EXISTS billing_subscription_id TEXT`;
  await sql`ALTER TABLE lelu_users ADD COLUMN IF NOT EXISTS plan_event_at TIMESTAMPTZ`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_lelu_users_billing_customer
      ON lelu_users (billing_provider, billing_customer_id) WHERE billing_customer_id IS NOT NULL
  `;

  // Per-account monthly call volume (Enterprise, or a one-off arrangement).
  // NULL means the plan's own amount. See lib/billing/plans.ts.
  await sql`ALTER TABLE lelu_users ADD COLUMN IF NOT EXISTS call_limit_override BIGINT`;

  // One row per account per month of overage billed. The primary key makes
  // the monthly job safe to re-run: a month is charged at most once, and a
  // failed charge stays 'failed' until a later run retries it.
  await sql`
    CREATE TABLE IF NOT EXISTS lelu_overage_charges (
      user_id          TEXT NOT NULL,
      period_start     DATE NOT NULL,
      plan             TEXT NOT NULL,
      included_calls   BIGINT NOT NULL,
      used_calls       BIGINT NOT NULL,
      blocks           INTEGER NOT NULL,
      status           TEXT NOT NULL DEFAULT 'pending',
      error            TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, period_start)
    )
  `;

  // Backfill for databases created before OAuth-only (no password) users existed.
  await sql`
    ALTER TABLE lelu_users ALTER COLUMN password_hash DROP NOT NULL
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS lelu_oauth_accounts (
      id                  TEXT PRIMARY KEY,
      user_id             TEXT NOT NULL REFERENCES lelu_users(id) ON DELETE CASCADE,
      provider            TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (provider, provider_account_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_lelu_oauth_accounts_user ON lelu_oauth_accounts (user_id)
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
    CREATE TABLE IF NOT EXISTS lelu_password_reset_tokens (
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

  await sql`
    CREATE TABLE IF NOT EXISTS lelu_policies (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES lelu_users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      rules       JSONB NOT NULL DEFAULT '[]',
      is_active   BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_lelu_policies_user ON lelu_policies (user_id, is_active)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS lelu_audit_events (
      id            BIGSERIAL PRIMARY KEY,
      trace_id      TEXT NOT NULL DEFAULT '',
      user_id       TEXT REFERENCES lelu_users(id) ON DELETE SET NULL,
      key_id        TEXT,
      actor         TEXT NOT NULL,
      action        TEXT NOT NULL,
      decision      TEXT NOT NULL CHECK (decision IN ('allowed', 'denied', 'human_review', 'compute')),
      reason        TEXT NOT NULL DEFAULT '',
      rule          TEXT NOT NULL DEFAULT '',
      policy_name   TEXT,
      confidence    NUMERIC(4,3) NOT NULL DEFAULT 1.0,
      latency_ms    INTEGER NOT NULL DEFAULT 0,
      mode          TEXT NOT NULL DEFAULT 'live',
      input_hash    TEXT,
      output_hash   TEXT,
      policy_digest TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_lelu_audit_user ON lelu_audit_events (user_id, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_lelu_audit_decision ON lelu_audit_events (decision, created_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS lelu_agents (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL REFERENCES lelu_users(id) ON DELETE CASCADE,
      name         TEXT NOT NULL,
      description  TEXT NOT NULL DEFAULT '',
      agent_type   TEXT NOT NULL DEFAULT 'autonomous',
      owner_email  TEXT NOT NULL DEFAULT '',
      status       TEXT NOT NULL DEFAULT 'active',
      scopes       JSONB NOT NULL DEFAULT '[]',
      last_seen_at TIMESTAMPTZ,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_lelu_agents_user ON lelu_agents (user_id, status)
  `;
}
