export default function DocsApiQueue() {
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
          Queue API
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Endpoints for managing the human-in-the-loop approval queue. Use these to list pending
          reviews and submit human decisions. The queue is served by the Lelu engine (the one{" "}
          <code>npx lelu-mcp start</code> runs, or your self-hosted engine); the hosted cloud does
          not serve these routes yet.
        </p>
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mt-4">
          Every route takes the review ID: the <code>review_id</code> an authorize response returns
          with a <code>human_review</code> decision (<code>decision.reviewId</code> in the TypeScript
          SDK, <code>decision.review_id</code> in Python). The request ID / <code>trace_id</code> is
          only for tracing and is not a queue key.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            List Pending Reviews
          </h2>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
              <span className="text-xs font-bold text-blue-400">GET</span>
              <span className="text-xs text-zinc-400 font-mono">/v1/queue/pending</span>
            </div>
            <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              <pre>
                <code>{`// Response
{
  "items": [
    {
      "id": "5b3e2c1a-8f4d-4e6b-9a7c-2d1f0e9b8a76", // the review ID
      "actor": "agent-123",
      "action": "delete_user",
      "resource": { "id": "user:456" },
      "confidence_score": 0.85,
      "reason": "Destructive actions require human approval.",
      "status": "pending",
      "enqueued_at": "2026-11-27T10:00:00Z"
    }
  ],
  "count": 1,
  "total": 1,
  "offset": 0,
  "limit": 50
}`}</code>
              </pre>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Approve a Request
          </h2>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
              <span className="text-xs font-bold text-green-400">POST</span>
              <span className="text-xs text-zinc-400 font-mono">/v1/queue/:review_id/approve</span>
            </div>
            <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              <pre>
                <code>{`// Request Body
{
  "resolved_by": "user_789",
  "note": "Approved per support ticket #9921" // Optional
}
// With LELU_REVIEWER_KEYS set on the engine, also send the reviewer's key in
// X-Lelu-Reviewer-Key; the engine then records that reviewer as resolved_by.

// Response (200 OK)
{
  "success": true,
  "resolved_by": "user_789",
  "reviewer_authenticated": false
}`}</code>
              </pre>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Deny a Request
          </h2>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
              <span className="text-xs font-bold text-green-400">POST</span>
              <span className="text-xs text-zinc-400 font-mono">/v1/queue/:review_id/deny</span>
            </div>
            <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              <pre>
                <code>{`// Request Body
{
  "resolved_by": "user_789",
  "note": "Agent misunderstood the user's intent." // Optional
}

// Response (200 OK)
{
  "success": true,
  "resolved_by": "user_789",
  "reviewer_authenticated": false
}`}</code>
              </pre>
            </div>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a
          href="/docs/api/authorize"
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
          Previous: Authorize API
        </a>
        <a
          href="/docs/api/agent"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          Next: Agent API
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
