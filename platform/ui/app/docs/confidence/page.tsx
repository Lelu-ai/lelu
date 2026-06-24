export default function DocsConfidence() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm font-medium mb-6">
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
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          Core Concepts
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">
          Confidence Scores
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Confidence scores are the heart of Lelu's dynamic authorization model. They allow you to
          quantify the risk of an action and require human approval when the AI's confidence is too
          low.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2
            id="how-it-works"
            className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4"
          >
            How it Works
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            When an AI agent requests to perform an action, it must provide a confidence score
            between 0.0 and 1.0. This score represents the agent's certainty that the action is safe
            and correct.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                0.9 - 1.0
              </div>
              <h3 className="font-medium text-zinc-900 dark:text-white mb-1">High Confidence</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Action is automatically approved and executed immediately.
              </p>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 mb-2">
                0.6 - 0.89
              </div>
              <h3 className="font-medium text-zinc-900 dark:text-white mb-1">Medium Confidence</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Action is queued for human review. Execution is paused.
              </p>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <div className="text-3xl font-bold text-red-600 dark:text-red-400 mb-2">&lt; 0.6</div>
              <h3 className="font-medium text-zinc-900 dark:text-white mb-1">Low Confidence</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Action is automatically denied. No human review required.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2
            id="defining-thresholds"
            className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4"
          >
            Defining Thresholds in Rego
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            You define the required confidence thresholds for different actions using Open Policy
            Agent (OPA) Rego policies. This allows you to set stricter requirements for sensitive
            actions.
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono">auth.rego</span>
            </div>
            <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              <pre>
                <code>{`package lelu.authz

default allow = false
default requires_human_review = false

# Read actions are safe, require low confidence
allow {
    input.action == "read"
    input.confidence >= 0.5
}

# Write actions are sensitive, require high confidence
allow {
    input.action == "write"
    input.confidence >= 0.9
}

# If confidence is between 0.7 and 0.9 for a write, require human approval
requires_human_review {
    input.action == "write"
    input.confidence >= 0.7
    input.confidence < 0.9
}`}</code>
              </pre>
            </div>
          </div>
        </section>

        <section>
          <h2
            id="providing-confidence"
            className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4"
          >
            Providing Confidence via SDK
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            When using the Lelu SDK, your AI agent must provide its confidence score when requesting
            authorization.
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono">typescript</span>
            </div>
            <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              <pre>
                <code>{`import { createClient } from 'lelu-agent-auth';

const lelu = createClient({ apiKey: process.env.LELU_API_KEY });

// The model's verified confidence for this action (e.g. derived from logprobs)
const response = await lelu.authorize({
  tool: 'delete_user',
  actor: 'agent-123',
  context: { confidence: 0.85, actingFor: 'user:456' },
});

if (response.decision === 'human_review') {
  console.log('Action queued for human review. Request ID:', response.requestId);
}`}</code>
              </pre>
            </div>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a
          href="/docs/installation"
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
          Previous: Installation
        </a>
        <a
          href="/docs/human-in-loop"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          Next: Human-in-the-Loop
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
