export default function DocsStrands() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-sm font-medium mb-6">
          Integrations
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">Strands Agents</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Authorize every Strands tool call before it runs. Lelu registers as an
          intervention handler, so denials, safe-tool redirects, and human approval
          all use machinery Strands already has.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">How decisions map</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Lelu returns one of four decisions for any action, and each corresponds to an
            intervention action Strands already understands.
          </p>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-white/5">
                <tr>
                  <th className="text-left font-semibold text-zinc-900 dark:text-white px-4 py-3">Lelu decision</th>
                  <th className="text-left font-semibold text-zinc-900 dark:text-white px-4 py-3">Strands action</th>
                  <th className="text-left font-semibold text-zinc-900 dark:text-white px-4 py-3">Effect</th>
                </tr>
              </thead>
              <tbody className="text-zinc-600 dark:text-zinc-400">
                <tr className="border-t border-zinc-200 dark:border-white/10">
                  <td className="px-4 py-3 font-mono text-xs">allow</td>
                  <td className="px-4 py-3 font-mono text-xs">Proceed</td>
                  <td className="px-4 py-3">The tool runs as the model intended.</td>
                </tr>
                <tr className="border-t border-zinc-200 dark:border-white/10">
                  <td className="px-4 py-3 font-mono text-xs">deny</td>
                  <td className="px-4 py-3 font-mono text-xs">Deny</td>
                  <td className="px-4 py-3">Cancelled, and the model is told why so it can choose differently.</td>
                </tr>
                <tr className="border-t border-zinc-200 dark:border-white/10">
                  <td className="px-4 py-3 font-mono text-xs">compute</td>
                  <td className="px-4 py-3 font-mono text-xs">Transform</td>
                  <td className="px-4 py-3">Re-pointed at the safer tool your policy names.</td>
                </tr>
                <tr className="border-t border-zinc-200 dark:border-white/10">
                  <td className="px-4 py-3 font-mono text-xs">human_review</td>
                  <td className="px-4 py-3 font-mono text-xs">Confirm</td>
                  <td className="px-4 py-3">Paused for a person through Strands&apos; interrupt system.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Installation</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">terminal</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300">{`# Python
pip install "lelu-agent-auth-sdk[strands]"

# TypeScript
npm install lelu-agent-auth @strands-agents/sdk`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Python</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Pass the handler in <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">interventions</code>. Strands
            evaluates handlers in order and recommends putting cheap authorization checks first,
            so it belongs at the front of the list.
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">agent.py</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`from strands import Agent
from lelu import LeluClient
from lelu.strands import LeluIntervention

guard = LeluIntervention(
    LeluClient(base_url="http://localhost:8080"),
    actor="invoice_bot",
)

agent = Agent(tools=[refund, lookup_invoice], interventions=[guard])`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">TypeScript</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">agent.ts</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`import { Agent } from "@strands-agents/sdk";
import { LeluClient } from "lelu-agent-auth";
import { LeluIntervention } from "lelu-agent-auth/strands";

const agent = new Agent({
  tools: [refund, lookupInvoice],
  interventions: [new LeluIntervention({ client, actor: "invoice_bot" })],
});`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Mapping tools to permissions</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            By default the tool name is the permission checked. Pass <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">action_for</code> when
            your policy uses a different vocabulary.
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">agent.py</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`LeluIntervention(
    client,
    actor="invoice_bot",
    action_for=lambda call: f"tool:{call.name}",
)`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Human review</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            A <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">human_review</code> decision
            returns <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">Confirm</code>, pausing
            the agent so a person can approve in the flow your application already has.
          </p>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            If approval happens in Lelu&apos;s own review queue instead, set{" "}
            <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">on_review=&quot;deny&quot;</code> and
            resume it yourself. Redemption re-checks the payload against what the reviewer
            actually approved, so an approval cannot be spent on a call they never saw.
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">resume.py</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`outcome = await guard.evaluate(call)
if outcome.action == "review":
    result = await guard.redeem(outcome, timeout_ms=60_000)`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Failure behaviour</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Two independent failures, both closed by default. If the engine is unreachable the
            call is denied — an authorization engine that permits everything when it breaks is
            not an authorization engine. If the handler itself throws,{" "}
            <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">on_error</code> defaults
            to <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">&quot;deny&quot;</code> rather
            than Strands&apos; own <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">&quot;throw&quot;</code>.
          </p>
          <p className="text-zinc-600 dark:text-zinc-400">
            Set <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">fail_open=True</code> to
            override the first, deliberately.
          </p>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a href="/docs/integrations/langgraph" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Previous: LangGraph
        </a>
        <a href="/docs/integrations/mcp" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Next: MCP
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </a>
      </div>
    </div>
  );
}
