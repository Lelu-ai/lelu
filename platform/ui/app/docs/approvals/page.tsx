export default function DocsApprovals() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">Approvals</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          When a policy decision is <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">human_review</code>, Lelu
          suspends the action and waits for a human operator to approve or deny it before the agent can proceed.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">How approvals work</h2>
          <ol className="space-y-3 text-zinc-600 dark:text-zinc-400">
            {[
              "Agent calls /api/v1/authorize with a tool name and context.",
              "Lelu evaluates the request against active policies.",
              "If a rule matches with decision human_review, the response includes requestId and decision: human_review.",
              "Your agent pauses and polls /api/v1/approvals/:requestId until status changes.",
              "An operator approves or denies in the Lelu dashboard or via API.",
              "The agent receives the final decision and proceeds or aborts.",
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Polling for approval</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">agent.ts</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`async function waitForApproval(requestId: string, timeoutMs = 300_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await fetch(\`https://lelu-ai.com/api/v1/approvals/\${requestId}\`, {
      headers: { Authorization: \`Bearer \${process.env.LELU_API_KEY}\` },
    });
    const { status } = await res.json();

    if (status === "approved") return true;
    if (status === "denied") return false;

    await new Promise((r) => setTimeout(r, 3000)); // poll every 3s
  }

  throw new Error("Approval timed out");
}`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Approving via API</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">curl</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`# Approve
curl -X POST https://lelu-ai.com/api/v1/approvals/{requestId}/approve \\
  -H "Authorization: Bearer lelu_sk_..."

# Deny
curl -X POST https://lelu-ai.com/api/v1/approvals/{requestId}/deny \\
  -H "Authorization: Bearer lelu_sk_..." \\
  -d '{"reason": "Not safe to proceed at this time"}'`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Dashboard approvals</h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            All pending approvals appear in real time on the{" "}
            <a href="/audit?decision=human_review" className="text-blue-600 dark:text-blue-400 hover:underline">
              Audit Log
            </a>{" "}
            page. Operators can approve or deny with one click. Email and Slack notifications
            can be configured in Settings.
          </p>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a href="/docs/human-in-loop" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Previous: Human-in-the-loop
        </a>
        <a href="/docs/audit-trail" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Next: Audit Trail
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </a>
      </div>
    </div>
  );
}
