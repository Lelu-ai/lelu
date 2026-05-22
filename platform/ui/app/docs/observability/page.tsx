export default function DocsObservability() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 text-sm font-medium mb-6">
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
          Observability & Tracing
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Lelu provides comprehensive observability for AI agent authorization with OpenTelemetry
          integration, distributed tracing, and AI-specific semantic conventions.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Overview</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Unlike traditional HTTP tracing, Lelu's observability system captures AI-specific
            context including confidence scores, agent behavior, multi-agent coordination, and
            decision-making processes. This enables deep insights into how your AI agents are
            performing and making authorization decisions.
          </p>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4 flex gap-3 mb-6">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Observability is automatically enabled when you configure OpenTelemetry. No additional
              setup required for basic tracing.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Key Features
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                AI Agent Semantic Conventions
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Track agent ID, confidence scores, decision outcomes, and risk scores with
                standardized attributes.
              </p>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Distributed Tracing
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Follow requests across SDK, engine, policy evaluator, and database with correlated
                trace IDs.
              </p>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Performance Breakdown
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Measure latency for confidence gate, policy evaluation, risk assessment, and total
                request time.
              </p>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Multi-Agent Correlation
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Track delegation chains and swarm operations across multiple agents with correlation
                context.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Configuration
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Configure OpenTelemetry to export traces to your preferred backend (Jaeger, Zipkin, or
            any OTLP-compatible service).
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono">environment variables</span>
            </div>
            <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              <pre>
                <code>{`# Enable OpenTelemetry tracing
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=lelu-engine
OTEL_TRACES_EXPORTER=otlp

# Optional: Configure sampling
OTEL_TRACES_SAMPLER=always_on
OTEL_TRACES_SAMPLER_ARG=1.0`}</code>
              </pre>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            AI Agent Attributes
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Every authorization span includes AI-specific attributes that provide context about the
            agent and decision.
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono">span attributes</span>
            </div>
            <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              <pre>
                <code>{`{
  // Agent identification
  "ai.agent.id": "customer-support-agent",
  "ai.agent.type": "autonomous",
  
  // Request context
  "ai.request.intent": "refund:process",
  "ai.request.confidence": 0.85,
  "ai.request.acting_for": "user_123",
  
  // Decision details
  "ai.decision.type": "autonomous",
  "ai.decision.confidence": 0.85,
  "ai.decision.human_review": false,
  "ai.decision.risk_score": 0.15,
  "ai.decision.outcome": "allowed",
  
  // Performance metrics
  "ai.latency.ms": 85,
  "ai.latency.confidence_gate_ms": 5,
  "ai.latency.policy_eval_ms": 15,
  "ai.latency.risk_eval_ms": 3
}`}</code>
              </pre>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            SDK Integration
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            The TypeScript SDK automatically creates spans for authorization requests with full
            context propagation.
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono">typescript</span>
            </div>
            <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              <pre>
                <code>{`import { createClient } from 'lelu-agent-auth';

const lelu = createClient({
  apiKey: process.env.LELU_API_KEY,
});

// Tracing is automatic - spans are created for each request
const decision = await lelu.agentAuthorize({
  actor: 'support-agent',
  action: 'refund:process',
  resource: { order_id: '12345' },
  context: {
    confidence: 0.85,
    actingFor: 'user_123',
  },
});

// Span includes:
// - Agent ID and action
// - Confidence score
// - Decision outcome
// - Latency breakdown
// - Risk score`}</code>
              </pre>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Viewing Traces
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Use Jaeger, Zipkin, or any OpenTelemetry-compatible tool to visualize traces.
          </p>

          <div className="space-y-4">
            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Jaeger (Recommended)
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                Run Jaeger locally with Docker:
              </p>
              <div className="bg-zinc-900 rounded-lg p-3 font-mono text-xs text-zinc-300">
                docker run -d -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one:latest
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                Access UI at{" "}
                <code className="text-xs bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded">
                  http://localhost:16686
                </code>
              </p>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">Grafana Tempo</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                For production deployments, integrate with Grafana Tempo for long-term trace storage
                and analysis.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Use Cases</h2>

          <div className="space-y-6">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Debug Failed Authorizations
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Search traces by agent ID to see exactly why a request was denied, including
                confidence scores, policy evaluation results, and risk assessment.
              </p>
            </div>

            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Identify Performance Bottlenecks
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Compare latency metrics across components to find slow policy evaluations or
                database queries.
              </p>
            </div>

            <div className="border-l-4 border-purple-500 pl-4">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Track Multi-Agent Workflows
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Follow delegation chains across multiple agents to understand complex authorization
                flows.
              </p>
            </div>

            <div className="border-l-4 border-amber-500 pl-4">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">Compliance & Audit</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Export traces for compliance reporting with complete decision trails and timestamps.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Metrics</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            In addition to traces, Lelu exports Prometheus metrics for monitoring and alerting.
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono">prometheus metrics</span>
            </div>
            <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              <pre>
                <code>{`# Authorization decisions
ai_agent_requests_total{agent_id, action, outcome}

# Confidence scores
ai_agent_confidence_score{agent_id, action}

# Risk scores
ai_agent_risk_score{agent_id, action}

# Decision latency
ai_agent_decision_latency_seconds{agent_id, component}

# Human reviews
ai_agent_human_reviews_total{agent_id, reason}`}</code>
              </pre>
            </div>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a
          href="/docs/audit-trail"
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
          Previous: Audit Trail
        </a>
        <a
          href="/docs/behavioral-analytics"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          Next: Behavioral Analytics
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
