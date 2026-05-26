export default function DocsAuditSIEM() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">SIEM Export</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Stream Lelu audit events to your SIEM — Datadog, Splunk, Elastic, or any system that
          accepts webhooks or log forwarding. Every authorization decision is exported in
          real time.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Webhook delivery</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Configure a webhook endpoint in Settings → Integrations. Lelu will POST each
            event within 500ms of it being recorded.
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">Webhook payload</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`{
  "event": "authorization.decision",
  "id": 1042,
  "trace_id": "req_a1b2c3d4",
  "actor": "agent-prod",
  "action": "transfer_funds",
  "decision": "human_review",
  "reason": "Financial operations require human approval.",
  "rule": "review:financial-ops",
  "latency_ms": 8,
  "created_at": "2026-05-26T10:34:21Z"
}`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Datadog</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">Datadog Log Forwarder</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`# Use Lelu's audit query API in your log pipeline
curl "https://lelu-ai.com/api/v1/audit?from=\${LAST_RUN}" \\
  -H "Authorization: Bearer \${LELU_API_KEY}" | \\
  datadog-ci log submit --source lelu --service agent-auth`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Splunk HEC</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">splunk-forwarder.ts</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`import { setInterval } from "timers/promises";

for await (const _ of setInterval(60_000)) {
  const events = await fetchLeluAuditEvents({ from: lastRun });

  await fetch(process.env.SPLUNK_HEC_URL!, {
    method: "POST",
    headers: { Authorization: \`Splunk \${process.env.SPLUNK_HEC_TOKEN}\` },
    body: events.map((e) =>
      JSON.stringify({ event: e, sourcetype: "lelu:authorization" })
    ).join("\\n"),
  });

  lastRun = new Date().toISOString();
}`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">CSV / compliance export</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Download a CSV of all events from the Audit Log page, or via API:
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">curl</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300">{`curl "https://lelu-ai.com/api/v1/audit/export.csv" \\
  -H "Authorization: Bearer lelu_sk_..." \\
  -o audit-$(date +%F).csv`}</pre>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a href="/docs/audit-query" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Previous: Audit Query
        </a>
        <a href="/docs/scaling" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Next: Scaling
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </a>
      </div>
    </div>
  );
}
