export default function DocsDelegation() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-sm font-medium mb-6">
          Concepts
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">Delegation</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Delegation lets a principal grant a subset of its permissions to another agent.
          The delegated agent can only act within the bounds of what was delegated — it
          cannot escalate beyond the grantor&apos;s own scope.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Why delegation matters</h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            In multi-agent systems, a supervisor agent may spawn sub-agents to complete
            subtasks. Without delegation controls, a sub-agent could attempt actions that
            the supervisor itself isn&apos;t authorized for. Lelu enforces that delegated scope
            is always a strict subset of the delegator&apos;s scope.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Delegation token</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Create a scoped delegation token that the sub-agent uses to authorize its actions.
            The token expires and is bound to the allowed tool patterns.
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">supervisor.ts</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`import { createClient } from "lelu-agent-auth";

const lelu = createClient({ apiKey: process.env.LELU_API_KEY! });

// Supervisor creates a restricted token for the sub-agent
const token = await lelu.delegate({
  allowedTools: ["read_*", "search_*"],   // only read/search ops
  denyTools: ["delete_*", "write_*"],     // explicitly block destructive ops
  expiresIn: "1h",
  label: "research-sub-agent",
});

// Pass token to the sub-agent
const subAgent = new SubAgent({ leluToken: token.value });`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Sub-agent usage</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">sub-agent.ts</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`// Sub-agent uses the delegation token instead of the master API key
const lelu = createClient({ apiKey: delegationToken });

const decision = await lelu.authorize({ tool: "delete_record" });
// => { decision: "deny", reason: "delete_* is blocked in this delegation scope" }`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Key properties</h2>
          <ul className="space-y-2 text-zinc-600 dark:text-zinc-400">
            {[
              "Tokens cannot grant more permissions than the issuing key holds.",
              "Tokens expire automatically and can be revoked early.",
              "All sub-agent decisions are attributed to the delegation chain in the audit log.",
              "Nested delegation is supported — a sub-agent can further delegate to a sub-sub-agent, still bounded by its own scope.",
            ].map((item, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1 text-blue-500">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a href="/docs/concepts/policies" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Previous: Policies
        </a>
        <a href="/docs/human-in-loop" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Next: Human-in-the-loop
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </a>
      </div>
    </div>
  );
}
