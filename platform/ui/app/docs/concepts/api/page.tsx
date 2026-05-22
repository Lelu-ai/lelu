export default function DocsConceptApi() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-sm font-medium mb-6">
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
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          Concepts
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">
          API
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Lelu exposes two HTTP APIs: the Engine API for runtime authorization and tokens, and the
          Platform API for policies and audit operations.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 id="base-urls" className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Base URLs
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Use the Engine API for agent and human authorization decisions, and the Platform API for
            policy and audit management.
          </p>

          <div className="space-y-4">
            <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
              <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
                <span className="text-xs font-bold text-purple-400">Engine API</span>
                <span className="text-xs text-zinc-500 font-mono">
                  Default: http://lelu-engine-666101080696.us-central1.run.app
                </span>
              </div>
              <div className="p-4 text-sm text-zinc-300">
                Runtime endpoints for authorization, queue approvals, token lifecycle, and health.
              </div>
            </div>

            <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
              <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
                <span className="text-xs font-bold text-blue-400">Platform API</span>
                <span className="text-xs text-zinc-500 font-mono">
                  Default: http://localhost:9090
                </span>
              </div>
              <div className="p-4 text-sm text-zinc-300">
                Control-plane endpoints for policy CRUD, audit queries, and ingest.
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2
            id="authentication"
            className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4"
          >
            Authentication
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Most endpoints require{" "}
            <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">
              Authorization: Bearer &lt;API_KEY&gt;
            </code>
            . Health endpoints are public.
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">Engine authorize example</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              {`curl -X POST http://lelu-engine-666101080696.us-central1.run.app/v1/authorize \
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tenant_id": "default",
    "user_id": "user_123",
    "action": "view_invoices",
    "resource": {"type": "invoice", "id": "42"}
  }'`}
            </pre>
          </div>
        </section>

        <section>
          <h2
            id="engine-routes"
            className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4"
          >
            Engine Routes
          </h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5">
                  <th className="text-left px-4 py-3 font-semibold text-zinc-900 dark:text-white">
                    Method
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-zinc-900 dark:text-white">
                    Path
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-zinc-900 dark:text-white">
                    Purpose
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                <tr>
                  <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">POST</td>
                  <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400">
                    /v1/authorize
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    Authorize human user action.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">POST</td>
                  <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400">
                    /v1/agent/authorize
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    Authorize AI agent action with confidence gates.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">POST</td>
                  <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400">
                    /v1/tokens/mint
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    Mint short-lived scoped token.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">DELETE</td>
                  <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400">
                    /v1/tokens/{"{tokenID}"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    Revoke token by ID.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">GET</td>
                  <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400">
                    /v1/queue/pending
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    List pending human-review items.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">GET</td>
                  <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400">
                    /v1/queue/{"{id}"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    Get one queue item.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">POST</td>
                  <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400">
                    /v1/queue/{"{id}"}/approve
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    Approve queued action.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">POST</td>
                  <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400">
                    /v1/queue/{"{id}"}/deny
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    Deny queued action.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">GET</td>
                  <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400">/healthz</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    Engine health check.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">GET</td>
                  <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400">/metrics</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    Prometheus metrics.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2
            id="platform-routes"
            className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4"
          >
            Platform Routes
          </h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5">
                  <th className="text-left px-4 py-3 font-semibold text-zinc-900 dark:text-white">
                    Method
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-zinc-900 dark:text-white">
                    Path
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-zinc-900 dark:text-white">
                    Purpose
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                <tr>
                  <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">GET</td>
                  <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400">
                    /api/v1/policies
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">List policies.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">GET</td>
                  <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400">
                    /api/v1/policies/{"{name}"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">Get one policy.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">PUT</td>
                  <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400">
                    /api/v1/policies/{"{name}"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    Create or update policy.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">DELETE</td>
                  <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400">
                    /api/v1/policies/{"{name}"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">Delete policy.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">GET</td>
                  <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400">
                    /api/v1/audit
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    Query audit events.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">GET</td>
                  <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400">
                    /api/v1/audit/trace/{"{traceID}"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    Get events by trace ID.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">POST</td>
                  <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400">
                    /api/v1/audit/ingest
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    Append audit event (engine ingestion).
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">GET</td>
                  <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400">/healthz</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    Platform health check.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2
            id="response-format"
            className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4"
          >
            Standard Response Format
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Lelu APIs return JSON responses. Successful requests return 2xx. Errors return 4xx/5xx
            with an error payload.
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">
                Error Response (400 Bad Request)
              </span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              {`{
  "error": "confidence: confidence out of range"
}`}
            </pre>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a
          href="/docs/concepts/architecture"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Previous: Architecture
        </a>
        <a
          href="/docs/concepts/client"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          Next: Client SDK
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
}
