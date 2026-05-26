export default function DocsPoliciesVersioning() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">Policy Versioning</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Every policy change is versioned and signed. You can roll back to any previous version,
          compare diffs, and see which version was active during any audit event.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">How versioning works</h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            When you update a policy, Lelu creates a new immutable version with a
            monotonically increasing version number and an HMAC-SHA256 signature over the
            policy content. The audit log records which policy version was active at the
            time of each decision.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">List versions</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">curl</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`curl https://lelu-ai.com/api/v1/policies/{id}/versions \\
  -H "Authorization: Bearer lelu_sk_..."`}</pre>
          </div>
          <div className="mt-4 bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">Response</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`[
  { "version": 3, "created_at": "2026-05-26T10:00:00Z", "is_active": true },
  { "version": 2, "created_at": "2026-05-20T09:00:00Z", "is_active": false },
  { "version": 1, "created_at": "2026-05-15T08:00:00Z", "is_active": false }
]`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Roll back</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">curl</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`curl -X POST https://lelu-ai.com/api/v1/policies/{id}/rollback \\
  -H "Authorization: Bearer lelu_sk_..." \\
  -d '{"version": 2}'`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">GitOps deployment</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Manage policies as code and deploy on merge:
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">.github/workflows/deploy-policies.yml</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`- name: Deploy Lelu policies
  run: |
    for f in policies/*.json; do
      curl -X PUT https://lelu-ai.com/api/v1/policies/$(basename $f .json) \\
        -H "Authorization: Bearer \${{ secrets.LELU_API_KEY }}" \\
        -d @$f
    done`}</pre>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a href="/docs/policies/rego" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Previous: Rego Policies
        </a>
        <a href="/docs/scaling" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Next: Scaling
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </a>
      </div>
    </div>
  );
}
