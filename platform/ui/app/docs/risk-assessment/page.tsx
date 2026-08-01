export default function DocsRiskAssessment() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-sm font-medium mb-6">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          Advanced Features
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">
          Risk Assessment
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Dynamic risk scoring that combines action criticality, agent reliability, confidence
          scores, and anomaly detection to make intelligent authorization decisions.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 id="overview" className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Overview
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Risk assessment runs on every authorization request, calculating a risk score from 0 (no
            risk) to 1 (maximum risk). This score influences the final authorization decision
            alongside confidence gates and policy evaluation.
          </p>

          <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
            <h3 className="font-medium text-zinc-900 dark:text-white mb-4">Risk Score Formula</h3>
            <div className="bg-zinc-900 dark:bg-black rounded-lg p-4 font-mono text-sm text-zinc-300 mb-4">
              risk_score = criticality × (1 - confidence) × (1 + (1 - reliability)) × anomaly_factor
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Higher risk scores indicate more dangerous operations that may require additional
              scrutiny or human review.
            </p>
          </div>
        </section>

        <section>
          <h2
            id="risk-components"
            className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4"
          >
            Risk Components
          </h2>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-red-600 dark:text-red-400"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                </svg>
                Action Criticality (0-1)
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                How dangerous or impactful the action is. Determined by action keywords.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-900 dark:text-white font-medium">
                    High Risk (0.90):
                  </span>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    delete, approve, refund, transfer, payment, admin
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-900 dark:text-white font-medium">
                    Medium Risk (0.60):
                  </span>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    update, write, create, modify, issue
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-900 dark:text-white font-medium">
                    Low Risk (0.25):
                  </span>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    read, view, list, search, get
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-blue-600 dark:text-blue-400"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Confidence Score (0-1)
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                The AI agent's self-reported confidence. Lower confidence increases risk. Inverted
                in the formula: (1 - confidence).
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6">
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-green-600 dark:text-green-400"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <polyline points="17 11 19 13 23 9" />
                </svg>
                Agent Reliability (0-1)
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                Historical success rate of the agent. Calculated from past authorization decisions.
              </p>
              <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 text-xs font-mono text-zinc-700 dark:text-zinc-300">
                reliability = 1 - (denied_count / total_count)
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-amber-600 dark:text-amber-400"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Anomaly Factor (≥1.0)
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                Multiplier based on recent anomalous behavior. Increases risk when agent shows
                unusual patterns.
              </p>
              <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 text-xs font-mono text-zinc-700 dark:text-zinc-300">
                anomaly_factor = 1.0 + min(anomaly_count / 10, 0.5)
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 id="risk-bands" className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Risk Bands & Thresholds
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Different action criticality levels have different risk thresholds. High-criticality
            actions require lower risk scores to be approved.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="text-left py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                    Criticality
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                    Allow
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                    Review
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                    Read-Only
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                    Deny
                  </th>
                </tr>
              </thead>
              <tbody className="text-zinc-600 dark:text-zinc-400">
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <td className="py-3 px-4 font-medium">High (≥0.80)</td>
                  <td className="py-3 px-4">≤0.08</td>
                  <td className="py-3 px-4">≤0.22</td>
                  <td className="py-3 px-4">≤0.40</td>
                  <td className="py-3 px-4">&gt;0.40</td>
                </tr>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <td className="py-3 px-4 font-medium">Medium (0.50-0.79)</td>
                  <td className="py-3 px-4">≤0.15</td>
                  <td className="py-3 px-4">≤0.35</td>
                  <td className="py-3 px-4">≤0.55</td>
                  <td className="py-3 px-4">&gt;0.55</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium">Low (&lt;0.50)</td>
                  <td className="py-3 px-4">≤0.30</td>
                  <td className="py-3 px-4">≤0.55</td>
                  <td className="py-3 px-4">≤0.75</td>
                  <td className="py-3 px-4">&gt;0.75</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2
            id="example-calculations"
            className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4"
          >
            Example Calculations
          </h2>

          <div className="space-y-6">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6">
              <h3 className="font-semibold text-green-900 dark:text-green-400 mb-3">
                ✓ Low Risk - Approved
              </h3>
              <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                <div>
                  Action:{" "}
                  <code className="bg-white dark:bg-zinc-900 px-2 py-0.5 rounded">
                    read:user_profile
                  </code>
                </div>
                <div>Criticality: 0.25 (low)</div>
                <div>Confidence: 0.92 (high)</div>
                <div>Reliability: 0.95 (excellent)</div>
                <div>Anomaly Factor: 1.0 (normal)</div>
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 font-mono text-xs text-zinc-700 dark:text-zinc-300 mb-3">
                risk = 0.25 × (1 - 0.92) × (1 + (1 - 0.95)) × 1.0
                <br />
                risk = 0.25 × 0.08 × 1.05 × 1.0
                <br />
                risk = 0.021
              </div>
              <div className="text-sm font-medium text-green-900 dark:text-green-400">
                Result: ALLOW (risk 0.021 ≤ 0.30 threshold)
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
              <h3 className="font-semibold text-amber-900 dark:text-amber-400 mb-3">
                ⚠ Medium Risk - Review Required
              </h3>
              <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                <div>
                  Action:{" "}
                  <code className="bg-white dark:bg-zinc-900 px-2 py-0.5 rounded">
                    refund:process
                  </code>
                </div>
                <div>Criticality: 0.90 (high)</div>
                <div>Confidence: 0.75 (medium)</div>
                <div>Reliability: 0.88 (good)</div>
                <div>Anomaly Factor: 1.0 (normal)</div>
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 font-mono text-xs text-zinc-700 dark:text-zinc-300 mb-3">
                risk = 0.90 × (1 - 0.75) × (1 + (1 - 0.88)) × 1.0
                <br />
                risk = 0.90 × 0.25 × 1.12 × 1.0
                <br />
                risk = 0.252
              </div>
              <div className="text-sm font-medium text-amber-900 dark:text-amber-400">
                Result: REVIEW (risk 0.252 &gt; 0.22, ≤ 0.40 threshold)
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
              <h3 className="font-semibold text-red-900 dark:text-red-400 mb-3">
                ✗ High Risk - Denied
              </h3>
              <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                <div>
                  Action:{" "}
                  <code className="bg-white dark:bg-zinc-900 px-2 py-0.5 rounded">
                    admin:delete_database
                  </code>
                </div>
                <div>Criticality: 0.90 (high)</div>
                <div>Confidence: 0.45 (low)</div>
                <div>Reliability: 0.70 (concerning)</div>
                <div>Anomaly Factor: 1.3 (elevated)</div>
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 font-mono text-xs text-zinc-700 dark:text-zinc-300 mb-3">
                risk = 0.90 × (1 - 0.45) × (1 + (1 - 0.70)) × 1.3
                <br />
                risk = 0.90 × 0.55 × 1.30 × 1.3
                <br />
                risk = 0.841
              </div>
              <div className="text-sm font-medium text-red-900 dark:text-red-400">
                Result: DENY (risk 0.841 &gt; 0.40 threshold)
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2
            id="configuration"
            className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4"
          >
            Configuration
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Risk thresholds can be customized via environment variables to match your organization's
            risk tolerance.
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono">environment variables</span>
            </div>
            <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              <pre>
                <code>{`# High criticality band (≥0.80)
RISK_ALLOW_THRESHOLD_HIGH=0.08
RISK_REVIEW_THRESHOLD_HIGH=0.22
RISK_READONLY_THRESHOLD_HIGH=0.40

# Medium criticality band (0.50-0.79)
RISK_ALLOW_THRESHOLD_MID=0.15
RISK_REVIEW_THRESHOLD_MID=0.35
RISK_READONLY_THRESHOLD_MID=0.55

# Low criticality band (<0.50)
RISK_ALLOW_THRESHOLD_LOW=0.30
RISK_REVIEW_THRESHOLD_LOW=0.55
RISK_READONLY_THRESHOLD_LOW=0.75

# Criticality boundaries
RISK_CRITICALITY_HIGH_MIN=0.80
RISK_CRITICALITY_MID_MIN=0.50`}</code>
              </pre>
            </div>
          </div>
        </section>

        <section>
          <h2
            id="best-practices"
            className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4"
          >
            Best Practices
          </h2>

          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">Start Conservative</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Begin with stricter thresholds and gradually relax them as you gain confidence in
                your agents.
              </p>
            </div>

            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Monitor Risk Scores
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Track risk score distributions to understand typical patterns and identify outliers.
              </p>
            </div>

            <div className="border-l-4 border-amber-500 pl-4">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Tune for Your Use Case
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Adjust thresholds based on your specific risk tolerance and operational
                requirements.
              </p>
            </div>

            <div className="border-l-4 border-purple-500 pl-4">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Combine with Policies
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Risk assessment works alongside policy evaluation - both must pass for
                authorization.
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a
          href="/docs/behavioral-analytics"
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
          Previous: Behavioral Analytics
        </a>
        <a
          href="/docs/multi-agent"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          Next: Multi-Agent Coordination
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
