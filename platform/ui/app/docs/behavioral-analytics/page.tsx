export default function DocsBehavioralAnalytics() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-sm font-medium mb-6">
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
          Behavioral Analytics
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Track agent behavior over time with reputation scoring, anomaly detection, baseline
          management, and automated alerting to ensure safe and reliable AI agent operations.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Overview</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Behavioral analytics runs asynchronously in the background, analyzing every
            authorization decision to build a comprehensive understanding of agent behavior. This
            enables proactive detection of issues before they become problems.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
              <div className="text-2xl mb-2">🎯</div>
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">Reputation Scoring</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Track agent reliability based on decision accuracy and confidence calibration.
              </p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
              <div className="text-2xl mb-2">🚨</div>
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">Anomaly Detection</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Identify unusual behavior patterns using Isolation Forest algorithm.
              </p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5">
              <div className="text-2xl mb-2">📊</div>
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Baseline Management
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Establish normal behavior patterns and detect drift over time.
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-5">
              <div className="text-2xl mb-2">🔔</div>
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">Real-time Alerting</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Automated alerts for low reputation, anomalies, and baseline drift.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Reputation Scoring
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Agent reputation is calculated based on historical decision accuracy, confidence
            calibration, and overall reliability. Scores range from 0 (unreliable) to 1 (highly
            reliable).
          </p>

          <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
            <h3 className="font-medium text-zinc-900 dark:text-white mb-4">
              Reputation Components
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                <div>
                  <div className="font-medium text-sm text-zinc-900 dark:text-white">
                    Accuracy Rate
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    Percentage of correct decisions over time
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-2"></div>
                <div>
                  <div className="font-medium text-sm text-zinc-900 dark:text-white">
                    Calibration Score
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    How well confidence scores align with actual outcomes
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-purple-500 mt-2"></div>
                <div>
                  <div className="font-medium text-sm text-zinc-900 dark:text-white">
                    Decision Count
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    Total number of authorization decisions made
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono">typescript</span>
            </div>
            <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              <pre>
                <code>{`import { createClient } from 'lelu-agent-auth';

const lelu = createClient({ apiKey: process.env.LELU_API_KEY });

// Get agent reputation
const reputation = await lelu.getAgentReputation('support-agent');

console.log(\`Reputation Score: \${reputation.reputation_score}\`);
console.log(\`Accuracy Rate: \${reputation.accuracy_rate * 100}%\`);
console.log(\`Calibration: \${reputation.calibration_score}\`);
console.log(\`Total Decisions: \${reputation.decision_count}\`);

// List top performing agents
const topAgents = await lelu.listAgentReputations({
  sort: 'top',
  limit: 10,
  threshold: 0.8, // Only agents with >80% reputation
});`}</code>
              </pre>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Anomaly Detection
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Lelu uses the Isolation Forest algorithm to detect unusual behavior patterns in
            real-time. Anomalies are scored from 0 (normal) to 1 (highly anomalous).
          </p>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 flex gap-3 mb-6">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Anomaly detection runs asynchronously and does not block authorization decisions.
              Alerts are triggered for high-severity anomalies.
            </p>
          </div>

          <div className="space-y-4 mb-6">
            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">Features Analyzed</h3>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                <li>• Confidence score patterns</li>
                <li>• Decision latency variations</li>
                <li>• Action frequency changes</li>
                <li>• Error rate spikes</li>
                <li>• Temporal patterns (time of day, day of week)</li>
              </ul>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">Severity Levels</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-zinc-900 dark:text-white font-medium">
                    Severe (0.9-1.0):
                  </span>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Immediate attention required
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="text-zinc-900 dark:text-white font-medium">
                    High (0.7-0.89):
                  </span>
                  <span className="text-zinc-600 dark:text-zinc-400">Investigate soon</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="text-zinc-900 dark:text-white font-medium">
                    Medium (0.5-0.69):
                  </span>
                  <span className="text-zinc-600 dark:text-zinc-400">Monitor closely</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-zinc-900 dark:text-white font-medium">Low (&lt;0.5):</span>
                  <span className="text-zinc-600 dark:text-zinc-400">Normal variation</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono">typescript</span>
            </div>
            <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              <pre>
                <code>{`// Get recent anomalies for an agent
const anomalies = await lelu.getAgentAnomalies(
  'support-agent',
  new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
);

anomalies.anomalies.forEach(anomaly => {
  if (anomaly.is_anomaly) {
    console.log(\`Anomaly detected at \${anomaly.timestamp}\`);
    console.log(\`Severity: \${anomaly.severity}\`);
    console.log(\`Score: \${anomaly.anomaly_score}\`);
    console.log(\`Explanation: \${anomaly.explanation}\`);
  }
});`}</code>
              </pre>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Baseline Management
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Baselines establish normal behavior patterns for each agent. Lelu automatically detects
            when agent behavior drifts from the baseline, indicating potential issues.
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono">typescript</span>
            </div>
            <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              <pre>
                <code>{`// Get baseline health for an agent
const baseline = await lelu.getAgentBaseline('support-agent');

console.log(\`Overall Health: \${baseline.health.overall_health}\`);
console.log(\`Sample Count: \${baseline.health.sample_count}\`);
console.log(\`Needs Refresh: \${baseline.health.needs_refresh}\`);

// Check for drift
if (baseline.drift.drift_score > 0.5) {
  console.log(\`Drift detected: \${baseline.drift.drift_type}\`);
  console.log(\`Severity: \${baseline.drift.severity}\`);
  console.log(\`Recommendations:\`);
  baseline.drift.recommendations.forEach(rec => {
    console.log(\`  - \${rec}\`);
  });
}

// Manually refresh baseline if needed
if (baseline.health.needs_refresh) {
  await lelu.refreshAgentBaseline('support-agent');
}`}</code>
              </pre>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Alerting</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Automated alerts notify you of critical issues including low reputation, high-severity
            anomalies, and significant baseline drift.
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono">typescript</span>
            </div>
            <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              <pre>
                <code>{`// Get active alerts
const alerts = await lelu.getAlerts();

alerts.alerts.forEach(alert => {
  console.log(\`[\${alert.severity.toUpperCase()}] \${alert.title}\`);
  console.log(\`Agent: \${alert.agent_id}\`);
  console.log(\`Description: \${alert.description}\`);
  console.log(\`Status: \${alert.status}\`);
});

// Acknowledge an alert
await lelu.acknowledgeAlert(
  'alert_123',
  'admin@company.com'
);

// Resolve an alert
await lelu.resolveAlert('alert_123');`}</code>
              </pre>
            </div>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
            <h3 className="font-medium text-zinc-900 dark:text-white mb-3">Alert Channels</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
              Configure alert notifications through multiple channels:
            </p>
            <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
              <li>• Slack notifications</li>
              <li>• Email alerts</li>
              <li>• Webhook integrations</li>
              <li>• PagerDuty incidents</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Best Practices
          </h2>

          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Monitor Reputation Trends
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Track reputation scores over time to identify agents that need retraining or policy
                adjustments.
              </p>
            </div>

            <div className="border-l-4 border-amber-500 pl-4">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Investigate Anomalies Promptly
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                High-severity anomalies may indicate security issues, bugs, or unexpected agent
                behavior.
              </p>
            </div>

            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Refresh Baselines Regularly
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Update baselines after significant changes to agent behavior or policies to maintain
                accuracy.
              </p>
            </div>

            <div className="border-l-4 border-purple-500 pl-4">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Set Appropriate Thresholds
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Configure alert thresholds based on your risk tolerance and operational
                requirements.
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a
          href="/docs/observability"
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
          Previous: Observability
        </a>
        <a
          href="/docs/risk-assessment"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          Next: Risk Assessment
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
