import { getComplianceExport, getShadowSummary, listAuditEvents, type ShadowSummaryResponse } from "@/lib/api";
import { AuditTable } from "@/components/AuditTable";

export const dynamic = "force-dynamic";

function buildSparklinePoints(summary: ShadowSummaryResponse): string {
  const buckets = Array.isArray(summary?.buckets) ? summary.buckets : [];
  const values = buckets.map((bucket) => bucket.allow + bucket.review + bucket.deny);
  if (values.length === 0) return "0,24 240,24";
  const maxValue = Math.max(...values, 1);
  const width = 240;
  const height = 48;
  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
      const y = height - (value / maxValue) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function formatAgo(ts: string): string {
  const then = new Date(ts).getTime();
  const now = Date.now();
  const delta = Math.max(0, Math.floor((now - then) / 1000));
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; action?: string; decision?: string }>;
}) {
  const params = await searchParams;

  const [events, shadow, compliance] = await Promise.all([
    listAuditEvents({
      actor: params.actor,
      action: params.action,
      decision: params.decision,
      limit: 100,
    }).catch(() => []),
    getShadowSummary(60).catch(() => null),
    getComplianceExport("all").catch(() => null),
  ]);
  const sparklinePoints = shadow ? buildSparklinePoints(shadow) : "0,24 240,24";
  const knownControls = 6;
  const coverageCount = compliance?.controls?.length ?? 0;
  const coveragePercent = Math.round((coverageCount / knownControls) * 100);

  const safeEvents = Array.isArray(events) ? events : [];
  const total = safeEvents.length;
  const allowed  = safeEvents.filter((e) => e.decision === "allowed").length;
  const denied   = safeEvents.filter((e) => e.decision === "denied").length;
  const review   = safeEvents.filter((e) => e.decision === "human_review").length;
  const highRiskIncidents = safeEvents
    .filter((event) => event.decision === "denied" || event.decision === "human_review")
    .slice(0, 8);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Audit Log</h1>
          <p className="text-zinc-600 dark:text-zinc-400">SOC 2-ready immutable event trail</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-200 rounded-md text-sm font-medium transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Export CSV
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
        <div className="p-5 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/50">
          <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Total Events</div>
          <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{total}</div>
          <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 mt-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
              <polyline points="16 7 22 7 22 13"></polyline>
            </svg>
            +12% this week
          </div>
        </div>
        <div className="p-5 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/50">
          <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Allowed</div>
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">{allowed}</div>
          <div className="flex items-center gap-1 text-xs text-zinc-500 mt-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Stable
          </div>
        </div>
        <div className="p-5 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/50">
          <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Denied</div>
          <div className="text-3xl font-bold text-red-600 dark:text-red-400">{denied}</div>
          <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 mt-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 17 13.5 8.5 8.5 13.5 2 7"></polyline>
              <polyline points="16 17 22 17 22 11"></polyline>
            </svg>
            -5% this week
          </div>
        </div>
        <div className="p-5 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/50">
          <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Human Review</div>
          <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{review}</div>
          <div className="flex items-center gap-1 text-xs text-zinc-500 mt-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Stable
          </div>
        </div>
      </div>

      <div className="mb-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Shadow Mode (last 60m)</h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {shadow?.mode === "shadow" ? "active" : "enforce mode"}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 bg-white dark:bg-zinc-900/40">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Allow</p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{shadow?.totals?.allow ?? 0}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 bg-white dark:bg-zinc-900/40">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Review</p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{shadow?.totals?.review ?? 0}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 bg-white dark:bg-zinc-900/40">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Deny</p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{shadow?.totals?.deny ?? 0}</p>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-zinc-200 dark:border-zinc-800 px-2 py-2 bg-white dark:bg-zinc-900/40">
          <svg viewBox="0 0 240 48" className="h-12 w-full" role="img" aria-label="Shadow decisions sparkline">
            <polyline
              fill="none"
              stroke="currentColor"
              className="text-zinc-700 dark:text-zinc-300"
              strokeWidth="2"
              points={sparklinePoints}
            />
          </svg>
        </div>
      </div>

      <div className="mb-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Compliance Coverage</h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">OWASP GenAI + NIST AI RMF</span>
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 bg-white dark:bg-zinc-900/40">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Controls Observed</p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{coverageCount}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 bg-white dark:bg-zinc-900/40">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Coverage</p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{coveragePercent}%</p>
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 bg-white dark:bg-zinc-900/40">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Mapped Events</p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{compliance?.total_events ?? 0}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 bg-white dark:bg-zinc-900/40">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Evidence</p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {compliance?.evidence?.signed ? "Signed" : "Unsigned"}
            </p>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 bg-white dark:bg-zinc-900/40">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Top Controls</p>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {(compliance?.controls ?? [])
              .slice(0, 3)
              .map((control) => `${control.id} (${control.event_count})`)
              .join(" · ") || "No controls mapped yet"}
          </p>
        </div>
      </div>

      <div className="mb-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recent High-Risk Incidents</h2>
          <div className="flex items-center gap-3 text-xs">
            <a href="/audit?decision=denied" className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              Denied
            </a>
            <a href="/audit?decision=human_review" className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              Human review
            </a>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 overflow-hidden">
          {highRiskIncidents.length === 0 ? (
            <p className="px-3 py-3 text-sm text-zinc-600 dark:text-zinc-400">No high-risk incidents in current view.</p>
          ) : (
            <ul>
              {highRiskIncidents.map((event, index) => (
                <li
                  key={`${event.id}-${event.trace_id}-${index}`}
                  className="px-3 py-3 border-b last:border-b-0 border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-900 dark:text-zinc-100 truncate">
                      <span className="font-medium">{event.actor}</span> · {event.action}
                    </p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate">
                      {event.reason || "Policy-triggered escalation"} · {event.trace_id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs border ${
                        event.decision === "denied"
                          ? "text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/60"
                          : "text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900/60"
                      }`}
                    >
                      {event.decision === "denied" ? "Denied" : "Human review"}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{formatAgo(event.timestamp || event.created_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <form method="GET" className="flex flex-col md:flex-row gap-3 mb-8 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/50">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-500">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <input
            name="actor"
            defaultValue={params.actor}
            placeholder="Filter by actor..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-sm text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
          />
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-500">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <input
            name="action"
            defaultValue={params.action}
            placeholder="Filter by action..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-sm text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
          />
        </div>
        <select
          name="decision"
          defaultValue={params.decision ?? ""}
          className="flex-1 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-sm text-zinc-900 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all appearance-none"
        >
          <option value="">All decisions</option>
          <option value="allowed">Allowed</option>
          <option value="denied">Denied</option>
          <option value="human_review">Human review</option>
        </select>
        <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm font-medium transition-colors">
          Filter
        </button>
      </form>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900/30">
        <AuditTable events={events} />
      </div>
    </div>
  );
}