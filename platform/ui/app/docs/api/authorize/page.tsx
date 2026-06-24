export default function DocsApiAuthorize() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 text-sm font-medium mb-6">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          API Reference
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">
          POST /api/v1/authorize
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          The core endpoint for requesting authorization. AI agents call this endpoint before
          performing any sensitive action.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Request</h2>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
              <span className="text-xs font-bold text-green-400">POST</span>
              <span className="text-xs text-zinc-400 font-mono">/api/v1/authorize</span>
            </div>
            <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              <pre>
                <code>{`{
  "tool": "send_email",            // Required: the tool/action to authorize (≤128 chars)
  "context": "optional context",   // Optional: free-form context string
  "args": {                        // Optional: structured tool arguments
    "to": "user@example.com"
  }
}`}</code>
              </pre>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Response</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Every call returns <span className="font-mono">200 OK</span> with the outcome in the{" "}
            <span className="font-mono">decision</span> field — one of <span className="font-mono">allow</span>,{" "}
            <span className="font-mono">deny</span>, <span className="font-mono">human_review</span>, or{" "}
            <span className="font-mono">compute</span> (redirected to a safe alternative, with{" "}
            <span className="font-mono">safeTool</span> / <span className="font-mono">safeArgs</span>). Each
            decision carries tamper-evident <span className="font-mono">inputHash</span> /{" "}
            <span className="font-mono">outputHash</span>.
          </p>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                Allowed (200 OK)
              </h3>
              <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
                <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
                  <pre>
                    <code>{`{
  "requestId": "req_a1b2c3d4",
  "tool": "list_invoices",
  "decision": "allow",
  "reason": "Read-only operations are permitted by the default policy.",
  "rule": "allow:read-ops",
  "latencyMs": 5,
  "mode": "live",
  "timestamp": "2026-06-23T12:00:00.000Z",
  "inputHash": "9f2c…",
  "outputHash": "4a7b…"
}`}</code>
                  </pre>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Human review (200 OK)
              </h3>
              <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
                <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
                  <pre>
                    <code>{`{
  "requestId": "req_5e6f7a8b",
  "tool": "issue_refund",
  "decision": "human_review",
  "reason": "Financial operations require a human to approve before execution.",
  "rule": "review:financial-ops",
  "latencyMs": 6,
  "mode": "live",
  "timestamp": "2026-06-23T12:00:00.000Z",
  "inputHash": "1b3d…",
  "outputHash": "8c2e…"
}`}</code>
                  </pre>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                Denied (200 OK)
              </h3>
              <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
                <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
                  <pre>
                    <code>{`{
  "requestId": "req_9c0d1e2f",
  "tool": "delete_all_records",
  "decision": "deny",
  "reason": "Destructive operations are blocked by the default safety policy.",
  "rule": "deny:destructive-ops",
  "latencyMs": 4,
  "mode": "live",
  "timestamp": "2026-06-23T12:00:00.000Z",
  "inputHash": "2a4f…",
  "outputHash": "6d9b…"
}`}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a
          href="/docs/audit-trail"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Previous: Audit Trail
        </a>
        <a
          href="/docs/api/queue"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          Next: Queue API
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
}
