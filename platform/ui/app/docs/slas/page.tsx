export default function DocsSLAs() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">SLAs</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Service level agreements for the Lelu hosted service. For enterprise SLAs with
          financial guarantees, contact the team.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Uptime commitments</h2>
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  {["Plan", "Uptime SLA", "Downtime / month"].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {[
                  ["Free", "No SLA", "—"],
                  ["Pro", "99.9%", "≤ 43 min"],
                  ["Enterprise", "99.99%", "≤ 4.3 min"],
                ].map(([plan, sla, downtime]) => (
                  <tr key={plan} className="bg-white dark:bg-zinc-900/30">
                    <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">{plan}</td>
                    <td className="px-6 py-4 text-zinc-700 dark:text-zinc-300">{sla}</td>
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">{downtime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Latency targets</h2>
          <div className="space-y-3">
            {[
              ["Authorize endpoint (p50)", "< 5ms"],
              ["Authorize endpoint (p99)", "< 50ms"],
              ["Approve/deny an action", "< 100ms"],
              ["Audit log write", "< 200ms"],
            ].map(([metric, target]) => (
              <div key={metric} className="flex justify-between items-center py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0">
                <span className="text-zinc-600 dark:text-zinc-400 text-sm">{metric}</span>
                <span className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">{target}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Incident response</h2>
          <div className="space-y-3">
            {[
              ["Severity 1 (service down)", "15 min", "Pro + Enterprise"],
              ["Severity 2 (degraded)", "2 hours", "Pro + Enterprise"],
              ["Severity 3 (minor issue)", "24 hours", "All plans"],
            ].map(([sev, response, plans]) => (
              <div key={sev} className="flex gap-4 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0">
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{sev}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{plans}</p>
                </div>
                <span className="font-mono text-sm font-semibold text-zinc-700 dark:text-zinc-300">Response: {response}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Status page</h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            Real-time status and incident history are available at{" "}
            <a href="https://status.lelu-ai.com" className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noreferrer">
              status.lelu-ai.com
            </a>
            . Subscribe to receive email or Slack alerts on incidents.
          </p>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a href="/docs/scaling" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Previous: Scaling
        </a>
        <a href="/docs/guides/production" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Next: Production Guide
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </a>
      </div>
    </div>
  );
}
