export default function DocsAuditQuery() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">Audit Query API</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Query the immutable audit log programmatically. Filter by actor, action, decision,
          time range, and more. Useful for compliance reports, incident investigations, and
          building custom dashboards.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">List events</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">GET /api/v1/audit</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`curl "https://lelu-ai.com/api/v1/audit?decision=denied&limit=50" \\
  -H "Authorization: Bearer lelu_sk_..."`}</pre>
          </div>

          <div className="mt-4 space-y-2">
            {[
              ["actor", "Filter by actor name (partial match)"],
              ["action", "Filter by tool/action name (partial match)"],
              ["decision", "One of: allowed, denied, human_review"],
              ["from", "ISO 8601 timestamp — events after this time"],
              ["to", "ISO 8601 timestamp — events before this time"],
              ["limit", "Max results, default 100, max 500"],
            ].map(([param, desc]) => (
              <div key={param} className="flex gap-3 text-sm">
                <code className="shrink-0 px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-zinc-700 dark:text-zinc-300">{param}</code>
                <span className="text-zinc-600 dark:text-zinc-400">{desc}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Response format</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">200 OK</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`[
  {
    "id": 1042,
    "trace_id": "req_a1b2c3d4",
    "actor": "sandbox",
    "action": "delete_all_records",
    "decision": "denied",
    "reason": "Destructive operations are blocked by the default safety policy.",
    "rule": "deny:destructive-ops",
    "confidence": 0.3,
    "latency_ms": 12,
    "mode": "sandbox",
    "created_at": "2026-05-26T10:34:21Z"
  }
]`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">TypeScript example</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">report.ts</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`const res = await fetch(
  "https://lelu-ai.com/api/v1/audit?decision=denied&from=2026-05-01T00:00:00Z",
  { headers: { Authorization: \`Bearer \${process.env.LELU_API_KEY}\` } }
);

const events = await res.json();
console.log(\`\${events.length} denied events in May\`);`}</pre>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a href="/docs/audit-trail" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Previous: Audit Trail
        </a>
        <a href="/docs/audit-siem" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Next: SIEM Export
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </a>
      </div>
    </div>
  );
}
