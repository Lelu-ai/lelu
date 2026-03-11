"use client";

export default function DatabaseConfigPage() {
  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">
          Database Configuration
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-2xl">
          Learn how to configure and manage PostgreSQL for Lelu&apos;s platform service, including schema details, migrations, and production best practices.
        </p>
      </div>

      {/* Overview */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Overview</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          Lelu uses PostgreSQL for persistent storage of policies, audit events, token revocations, and API keys. The platform service automatically runs migrations on startup.
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">Policies</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Authorization policies with versioning and HMAC signatures</p>
          </div>
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">Audit Events</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Immutable authorization decision logs</p>
          </div>
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">Token Revocations</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Revoked JIT token tracking</p>
          </div>
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">API Keys</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Platform authentication keys</p>
          </div>
        </div>
      </section>

      {/* Environment Variables */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Environment Variables</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          Configure these environment variables in your <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">.env</code> file:
        </p>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">DATABASE_URL</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              PostgreSQL connection string with credentials and database name.
            </p>
            
            <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
              <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
                <span className="text-xs text-zinc-500 font-mono">.env</span>
              </div>
              <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
                DATABASE_URL=postgres://lelu:password@localhost:5432/lelu?sslmode=disable
              </pre>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">PLATFORM_API_KEY</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              API key for authenticating requests to the platform service.
            </p>
            
            <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
              <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
                <span className="text-xs text-zinc-500 font-mono">.env</span>
              </div>
              <pre className="p-4 font-mono text-sm text-zinc-300">
                PLATFORM_API_KEY=platform-dev-key
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Docker Setup */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Docker Compose Setup</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          The default <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">docker-compose.yml</code> includes PostgreSQL with health checks and persistent storage:
        </p>

        <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
          <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
            <span className="text-xs text-zinc-500 font-mono">docker-compose.yml</span>
          </div>
          <pre className="p-4 font-mono text-sm text-zinc-300 leading-relaxed overflow-x-auto">
{`postgres:
  image: postgres:15
  container_name: lelu-postgres
  ports:
    - "5434:5432"
  environment:
    POSTGRES_DB: lelu
    POSTGRES_USER: lelu
    POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-lelu-dev-secret}
  volumes:
    - postgres-data:/var/lib/postgresql/data
  healthcheck:
    test: ["CMD", "pg_isready", "-U", "lelu"]
    interval: 5s`}
          </pre>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4 flex gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <p className="text-sm text-blue-800 dark:text-blue-300">
            PostgreSQL is exposed on port <code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded font-mono">5434</code> (host) → <code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded font-mono">5432</code> (container) to avoid conflicts with local PostgreSQL installations.
          </p>
        </div>
      </section>

      {/* Connection Pool */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Connection Pool Settings</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          The platform uses connection pooling for optimal performance. Current settings are hardcoded but will be configurable in a future release.
        </p>

        <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl p-6 mb-6">
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">Current Settings</h3>
          <div className="space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">Max Open Connections:</span>
              <span className="text-zinc-900 dark:text-white">25</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">Max Idle Connections:</span>
              <span className="text-zinc-900 dark:text-white">5</span>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 flex gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div className="text-sm text-amber-800 dark:text-amber-300">
            <strong>Coming Soon:</strong> Configurable connection pool settings via environment variables. Track progress in <a href="https://github.com/lelu-auth/lelu/issues" className="underline hover:text-amber-600 dark:hover:text-amber-200">GitHub Issues</a>.
          </div>
        </div>
      </section>

      {/* Migrations */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Automatic Migrations</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          Database migrations run automatically when the platform service starts. All migrations are idempotent and safe to run multiple times.
        </p>

        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-500/10 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600 dark:text-green-400">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-zinc-900 dark:text-white mb-1">001: Policies Table</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Creates policies table with tenant isolation and HMAC signatures</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-500/10 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600 dark:text-green-400">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-zinc-900 dark:text-white mb-1">002: Audit Events Table</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Creates immutable audit log with indexes for performance</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-500/10 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600 dark:text-green-400">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-zinc-900 dark:text-white mb-1">003: Token Revocations</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Tracks revoked JIT tokens for security</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-500/10 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600 dark:text-green-400">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-zinc-900 dark:text-white mb-1">004: API Keys Table</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Platform authentication key management</p>
            </div>
          </div>
        </div>
      </section>

      {/* SQLite vs PostgreSQL */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">SQLite vs PostgreSQL</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          Lelu supports both SQLite (local) and PostgreSQL (production) storage backends.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600 dark:text-blue-400">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
              SQLite
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Best for development, testing, and single-node deployments.
            </p>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li className="flex items-start gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600 dark:text-green-400 shrink-0 mt-0.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Zero configuration
              </li>
              <li className="flex items-start gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600 dark:text-green-400 shrink-0 mt-0.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Works offline
              </li>
              <li className="flex items-start gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600 dark:text-green-400 shrink-0 mt-0.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Fast for small datasets
              </li>
            </ul>
          </div>

          <div className="p-6 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-600 dark:text-purple-400">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              PostgreSQL
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Best for production, multi-node, and high-traffic deployments.
            </p>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li className="flex items-start gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600 dark:text-green-400 shrink-0 mt-0.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Scales horizontally
              </li>
              <li className="flex items-start gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600 dark:text-green-400 shrink-0 mt-0.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Multi-tenancy support
              </li>
              <li className="flex items-start gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600 dark:text-green-400 shrink-0 mt-0.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Advanced querying
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Production Tips */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Production Best Practices</h2>
        
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">Use Managed PostgreSQL</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              AWS RDS, Google Cloud SQL, Azure Database, or Supabase provide automated backups, scaling, and monitoring.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">Enable SSL/TLS</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
              Always use encrypted connections in production:
            </p>
            <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded font-mono">
              DATABASE_URL=postgres://...?sslmode=require
            </code>
          </div>

          <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">Set Up Automated Backups</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Configure daily backups with point-in-time recovery for disaster recovery.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/50">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">Monitor Performance</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Track connection pool utilization, query performance, and table sizes.
            </p>
          </div>
        </div>
      </section>

      {/* Next Steps */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-6">
        <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">Next Steps</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a href="/docs/audit-trail" className="flex items-center gap-3 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600 dark:text-blue-400">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
            <div>
              <div className="font-medium text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Audit Trail</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-500">View authorization logs</div>
            </div>
          </a>
          <a href="/docs/cli-commands" className="flex items-center gap-3 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-500/10 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-600 dark:text-purple-400">
                <polyline points="4 17 10 11 4 5"/>
                <line x1="12" y1="19" x2="20" y2="19"/>
              </svg>
            </div>
            <div>
              <div className="font-medium text-zinc-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">CLI Commands</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-500">Manage from terminal</div>
            </div>
          </a>
        </div>
      </div>

      {/* Prev / Next */}
      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a href="/docs/installation" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Previous: Installation
        </a>
        <a href="/docs/audit-trail" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Next: Audit Trail
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
}
