export default function DocsHumanInLoop() {
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
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          Core Concepts
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">
          Human-in-the-Loop
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          When an AI agent attempts an action with a confidence score that falls into the "requires
          approval" range, Lelu automatically pauses the execution and queues the request for human
          review.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            The Approval Workflow
          </h2>

          <div className="relative border-l-2 border-zinc-200 dark:border-zinc-800 ml-3 md:ml-4 space-y-8 pb-4 mt-8">
            <div className="relative pl-8">
              <div className="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500"></div>
              </div>
              <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
                1. Agent Requests Authorization
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                The AI agent calls the Lelu Engine with its intended action, resource, and
                confidence score.
              </p>
            </div>

            <div className="relative pl-8">
              <div className="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-400 dark:border-amber-600 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400"></div>
              </div>
              <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
                2. Policy Evaluation
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                Lelu evaluates the request against your Rego policies. If the confidence score is
                too low for automatic approval, the request is flagged as{" "}
                <code>human_review</code>.
              </p>
            </div>

            <div className="relative pl-8">
              <div className="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-400 dark:border-blue-600 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400"></div>
              </div>
              <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
                3. Request Queued
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                The request is added to the pending queue. The agent receives a response indicating
                it must wait, along with a <code>requestId</code>.
              </p>
            </div>

            <div className="relative pl-8">
              <div className="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 border-2 border-green-400 dark:border-green-600 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 dark:bg-green-400"></div>
              </div>
              <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
                4. Human Review
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                A human operator reviews the request in the Lelu UI (or via API) and either approves
                or denies it.
              </p>
            </div>

            <div className="relative pl-8">
              <div className="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-400 dark:border-purple-600 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 dark:bg-purple-400"></div>
              </div>
              <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
                5. Agent Resumes
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                The agent polls the status of the request (or receives a webhook). Once approved, it
                proceeds with the action.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Reviewing Requests in the UI
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            The Lelu Platform provides a built-in UI for reviewing pending requests. Operators can
            see the agent's reasoning, the requested action, and the confidence score before making
            a decision.
          </p>

          <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 flex flex-col items-center justify-center text-center">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-zinc-400 dark:text-zinc-500 mb-4"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
            <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
              Built-in Approval Dashboard
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md">
              Navigate to the "Policies" or "Queue" section in the Lelu UI to view and manage
              pending authorization requests.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Handling Approvals via API
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            You can also build custom approval workflows (e.g., Slack integrations) using the Lelu
            API.
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono">bash</span>
            </div>
            <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              <pre>
                <code>{`# Approve a request
curl -X POST https://lelu-ai.com/v1/queue/req_12345/approve \\
  -H "Authorization: Bearer YOUR_API_KEY"

# Deny a request
curl -X POST https://lelu-ai.com/v1/queue/req_12345/deny \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</code>
              </pre>
            </div>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a
          href="/docs/confidence"
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
          Previous: Confidence Scores
        </a>
        <a
          href="/docs/audit-trail"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          Next: Audit Trail
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
