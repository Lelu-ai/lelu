export default function DocsGuidesProduction() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 text-sm font-medium mb-6">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Guides
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">Production Deployment</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          A checklist and deep-dive for running Lelu reliably in production — covering HTTPS, secrets management, Engine scaling, and observability.
        </p>
      </div>

      <div className="space-y-12">

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-6">Pre-Launch Checklist</h2>
          
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Security & Infrastructure</h3>
          <div className="space-y-3 mb-6">
            {[
              { done: false, text: "TLS terminated at load balancer or ingress for all services" },
              { done: false, text: "LELU_API_KEY rotated from default and stored in a secret manager" },
              { done: false, text: "DATABASE_URL uses sslmode=require in production" },
              { done: false, text: "Redis uses TLS (rediss://) or a private network" },
              { done: false, text: "Engine replicas ≥ 2 for high availability" },
              { done: true,  text: "Health checks configured on /healthz for all services" },
              { done: false, text: "Prompt injection detection enabled (automatic)" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 ${item.done ? "bg-emerald-500" : "border-2 border-zinc-300 dark:border-zinc-600"}`}>
                  {item.done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{item.text}</span>
              </div>
            ))}
          </div>

          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Observability & Monitoring</h3>
          <div className="space-y-3 mb-6">
            {[
              { done: false, text: "OpenTelemetry tracing configured with Jaeger/Zipkin" },
              { done: false, text: "Prometheus metrics endpoint exposed and scraped" },
              { done: false, text: "Behavioral analytics enabled for agent monitoring" },
              { done: false, text: "Predictive analytics models trained with sufficient data (100+ samples)" },
              { done: false, text: "Alert channels configured (Slack, PagerDuty, email)" },
              { done: false, text: "Structured logs exported to your log platform" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 ${item.done ? "bg-emerald-500" : "border-2 border-zinc-300 dark:border-zinc-600"}`}>
                  {item.done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{item.text}</span>
              </div>
            ))}
          </div>

          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Policies & Compliance</h3>
          <div className="space-y-3 mb-6">
            {[
              { done: true,  text: "OPA/Rego policies are version-controlled before deploy" },
              { done: false, text: "Risk assessment thresholds tuned for your use case" },
              { done: false, text: "Confidence gates configured appropriately" },
              { done: false, text: "Audit retention configured (S3/object-store lifecycle, 1+ year)" },
              { done: false, text: "Human review workflows tested and documented" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 ${item.done ? "bg-emerald-500" : "border-2 border-zinc-300 dark:border-zinc-600"}`}>
                  {item.done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{item.text}</span>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4 flex gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              In Docker Compose healthchecks, prefer <span className="font-mono">127.0.0.1</span> over <span className="font-mono">localhost</span> to avoid container-local hostname resolution edge cases.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Scaling the Engine</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">The Engine is stateless — scale horizontally by running multiple replicas behind a load balancer. All state lives in Redis.</p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">docker-compose.override.yml</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`services:
  engine:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: "1"
          memory: 512M
      restart_policy:
        condition: on-failure
        delay: 5s`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Secrets Management</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">Never store secrets in environment files committed to source control. Use one of these patterns in production:</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { name: "AWS Secrets Manager", desc: "Use the AWS SSM Parameter Store or Secrets Manager and inject via IAM role at runtime." },
              { name: "Kubernetes Secrets", desc: "Mount as environment variables from an encrypted Secret object — use Sealed Secrets or External Secrets Operator." },
              { name: "HashiCorp Vault", desc: "Use Vault Agent Injector to automatically inject secrets into pods at startup." },
            ].map((s) => (
              <div key={s.name} className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                <h4 className="font-semibold text-zinc-900 dark:text-white text-sm mb-1">{s.name}</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Observability</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Lelu provides comprehensive metrics for monitoring authorization decisions, agent behavior, and system performance. Configure Prometheus scraping and alerting for production deployments.
          </p>

          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Core Metrics</h3>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">Authorization & HTTP metrics</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 leading-loose">{`lelu_http_requests_total{method="POST",path="/v1/agent/authorize",status="200"}
  # Request volume and status-code anomalies

lelu_http_request_duration_seconds{method="POST",path="/v1/agent/authorize"}
  # Latency SLO / p95 / p99

lelu_auth_decisions_total{type="agent",allowed="false"}
  # Deny-rate spikes and confidence policy pressure

lelu_agent_requests_total{agent_id,action,outcome}
  # Per-agent authorization outcomes

lelu_agent_confidence_score{agent_id,action}
  # Confidence score distribution

lelu_agent_risk_score{agent_id,action}
  # Risk score distribution`}</pre>
          </div>

          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Behavioral Analytics Metrics</h3>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">Reputation, anomalies, and alerts</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 leading-loose">{`lelu_agent_reputation_score{agent_id}
  # Current reputation score (0-1)

lelu_agent_anomaly_score{agent_id}
  # Anomaly detection score (0-1, higher = more anomalous)

lelu_agent_human_review_total{agent_id,reason}
  # Human review requirements by reason

lelu_policy_effectiveness_rate{policy_name,policy_version}
  # Policy success rate`}</pre>
          </div>

          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Predictive Analytics Metrics</h3>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">ML model performance</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 leading-loose">{`lelu_agent_prediction_accuracy{model_type,agent_id}
  # Model accuracy (0-1)

lelu_agent_prediction_latency_seconds{model_type}
  # Prediction latency

lelu_agent_predictions_total{model_type,outcome}
  # Prediction counts

lelu_agent_model_sample_count{model_type}
  # Training sample count`}</pre>
          </div>

          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Multi-Agent Coordination Metrics</h3>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">Delegation and swarm operations</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 leading-loose">{`lelu_agent_delegation_total{delegator,delegatee,outcome}
  # Agent delegation counts

lelu_swarm_operations_total{swarm_id,operation_type,outcome}
  # Swarm orchestration operations

lelu_swarm_agent_count{swarm_id}
  # Active agents per swarm`}</pre>
          </div>

          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Recommended Alerts</h3>
          <div className="space-y-3">
            {[
              { severity: "critical", metric: "lelu_agent_reputation_score < 0.5", desc: "Agent reputation dropped below 50%" },
              { severity: "critical", metric: "lelu_agent_anomaly_score > 0.9", desc: "Severe anomaly detected" },
              { severity: "warning", metric: "lelu_http_request_duration_seconds{quantile=\"0.95\"} > 0.5", desc: "P95 latency exceeds 500ms" },
              { severity: "warning", metric: "lelu_agent_prediction_accuracy < 0.7", desc: "ML model accuracy below 70%" },
              { severity: "info", metric: "lelu_policy_effectiveness_rate < 0.6", desc: "Policy effectiveness below 60%" },
            ].map((alert, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                <div className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${
                  alert.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                  alert.severity === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                  'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                }`}>
                  {alert.severity}
                </div>
                <div className="flex-1">
                  <div className="font-mono text-xs text-zinc-900 dark:text-white mb-1">{alert.metric}</div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">{alert.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Advanced Features Configuration</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Enable and configure advanced features for production deployments.
          </p>

          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">OpenTelemetry Tracing</h3>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">environment variables</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
OTEL_SERVICE_NAME=lelu-engine
OTEL_TRACES_EXPORTER=otlp
OTEL_TRACES_SAMPLER=always_on`}</pre>
          </div>

          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Behavioral Analytics</h3>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">environment variables</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`# Reputation thresholds
REPUTATION_LOW_THRESHOLD=0.5
REPUTATION_MIN_DECISIONS=10

# Anomaly detection
ANOMALY_DETECTION_ENABLED=true
ANOMALY_SEVERITY_THRESHOLD=0.7
ANOMALY_WINDOW_SIZE=100

# Baseline management
BASELINE_SAMPLE_SIZE=100
BASELINE_REFRESH_INTERVAL=24h`}</pre>
          </div>

          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Predictive Analytics</h3>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">environment variables</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`# Model training
MIN_SAMPLES_FOR_MODEL=100
MODEL_UPDATE_INTERVAL=6h
CONFIDENCE_MODEL_WINDOW=30d
REVIEW_MODEL_WINDOW=14d

# Prediction thresholds
CONFIDENCE_PREDICTION_THRESHOLD=0.7
REVIEW_PREDICTION_THRESHOLD=0.6
POLICY_OPTIMIZATION_THRESHOLD=0.5`}</pre>
          </div>

          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Prompt Injection Detection</h3>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">environment variables</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`# Enabled by default
PROMPT_INJECTION_DETECTION_ENABLED=true
PROMPT_INJECTION_SEVERITY_THRESHOLD=0.8

# Alert on high-severity detections
PROMPT_INJECTION_ALERT_ENABLED=true`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Multi-Agent Deployment Considerations</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            When deploying systems with multiple coordinating agents, consider these additional factors.
          </p>

          <div className="space-y-4">
            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <h3 className="font-semibold text-zinc-900 dark:text-white text-sm mb-2">Delegation Chain Limits</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                Set maximum delegation depth to prevent infinite loops and excessive latency.
              </p>
              <div className="bg-zinc-900 rounded-lg p-3 font-mono text-xs text-zinc-300">
                MAX_DELEGATION_DEPTH=5
              </div>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <h3 className="font-semibold text-zinc-900 dark:text-white text-sm mb-2">Swarm Coordination</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                Configure swarm size limits and timeout values for coordinated operations.
              </p>
              <div className="bg-zinc-900 rounded-lg p-3 font-mono text-xs text-zinc-300">
                MAX_SWARM_SIZE=10{'\n'}SWARM_OPERATION_TIMEOUT=30s
              </div>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <h3 className="font-semibold text-zinc-900 dark:text-white text-sm mb-2">Trace Context Propagation</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Ensure OpenTelemetry context is propagated across agent boundaries for complete trace visibility.
              </p>
            </div>
          </div>
        </section>

      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a href="/docs/plugins/rate-limit" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Previous: Rate Limiting
        </a>
        <a href="/docs/guides/testing" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Next: Testing Policies
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
      </div>
    </div>
  );
}
