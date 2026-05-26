export default function DocsScaling() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">Scaling</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Lelu is designed for high-throughput AI workloads. The hosted service handles
          millions of authorization requests per day. For self-hosted deployments, here&apos;s
          how to scale the engine.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Performance characteristics</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "p50 latency", value: "< 2ms" },
              { label: "p99 latency", value: "< 15ms" },
              { label: "Throughput", value: "50k req/s" },
            ].map((stat) => (
              <div key={stat.label} className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 text-center">
                <p className="text-2xl font-bold text-zinc-900 dark:text-white">{stat.value}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Measured on a single 2-vCPU Cloud Run instance. Latency includes policy evaluation, DB write, and response serialization.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Horizontal scaling</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            The Lelu engine is stateless — all state lives in Postgres and Redis. Scale
            horizontally by running multiple instances behind a load balancer.
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">docker-compose.yml</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`services:
  engine:
    image: ghcr.io/lelu-auth/lelu/engine:latest
    deploy:
      replicas: 4
    environment:
      DATABASE_URL: postgres://...
      REDIS_ADDR: redis:6379`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Policy caching</h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            Policies are cached in-memory per engine instance and refreshed from Postgres every
            30 seconds. You can force an immediate refresh after a policy update:
          </p>
          <div className="mt-4 bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">curl</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300">{`curl -X POST http://engine:8082/v1/cache/invalidate \\
  -H "Authorization: Bearer \${ENGINE_API_KEY}"`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Connection pooling</h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            Use PgBouncer or Supabase Pooler in transaction mode between your engine instances
            and Postgres to avoid connection exhaustion under load. Set{" "}
            <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">DB_MAX_CONNS=5</code>{" "}
            per engine instance when behind a pooler.
          </p>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a href="/docs/docker" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Previous: Docker
        </a>
        <a href="/docs/slas" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Next: SLAs
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </a>
      </div>
    </div>
  );
}
