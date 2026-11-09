export default function DocsPythonSDK() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-sm font-medium mb-6">
          SDK
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">
          Python SDK
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          The official Python SDK for Lelu — async-first, Pydantic-backed, and compatible with
          LangGraph, LangChain, and any async Python agent framework.
        </p>
      </div>

      <div className="space-y-12">
        {/* Install */}
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Install</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">pip</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300">{`pip install lelu-agent-auth-sdk`}</pre>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400 mt-4">
            Requires Python 3.11 or later. The package installs the{" "}
            <code className="font-mono text-sm bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">lelu</code> module.
          </p>
        </section>

        {/* Quick start */}
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Quick start</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">agent.py</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`import asyncio
import os
from lelu import AgentContext, AuthorizeRequest, LeluClient

async def main():
    # Point at the engine you run and pass its key. Without base_url (or
    # LELU_BASE_URL), an API key makes the client target https://lelu-ai.com.
    async with LeluClient(
        base_url="http://localhost:8083",  # e.g. the Docker Compose engine
        api_key=os.environ["LELU_API_KEY"],
    ) as lelu:
        req = AuthorizeRequest(
            tool="delete_records",
            context=AgentContext(confidence=0.9, acting_for="user_123"),
            args={"table": "invoices"},
        )
        result = await lelu.authorize(req)

        if result.allowed:
            print("Proceeding autonomously")
        elif result.computed:
            # Platform returned a safe alternative
            print(f"Using safe alternative: {result.safe_tool}")
            print(f"With args: {result.safe_args}")
        elif result.requires_human_review:
            # The queue key is result.review_id — request_id is only the trace ID.
            print(f"Queued for review — review ID: {result.review_id}")
            # Wait for the reviewer (the engine caps one wait at 60s), then
            # re-check this exact request against the approval.
            outcome = await lelu.wait_and_redeem(result, req, timeout_ms=60_000)
            if outcome.allowed:
                print("Approved — proceeding")
            else:
                print(f"Not approved: {outcome.reason}")
        else:
            print(f"Denied: {result.reason}")

asyncio.run(main())`}</pre>
          </div>
        </section>

        {/* Four decisions */}
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Four decision outcomes</h2>
          <div className="space-y-3">
            {[
              { decision: "allow", color: "emerald", desc: "Agent proceeds autonomously. result.allowed == True." },
              { decision: "compute", color: "violet", desc: "Platform returns a safe alternative. Use result.safe_tool and result.safe_args." },
              { decision: "human_review", color: "amber", desc: "Action queued for human approval. result.requires_human_review == True; pass result (or result.review_id) to wait_and_redeem()." },
              { decision: "deny", color: "red", desc: "Action blocked. Check result.reason for explanation." },
            ].map(({ decision, color, desc }) => (
              <div key={decision} className={`flex gap-3 p-4 rounded-xl border bg-${color}-50 dark:bg-${color}-900/10 border-${color}-200 dark:border-${color}-800/30`}>
                <code className={`text-sm font-mono font-bold text-${color}-700 dark:text-${color}-400 shrink-0 pt-0.5`}>{decision}</code>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* LangGraph */}
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">LangGraph integration</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Use the <code className="font-mono text-sm bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">@secure_node</code> decorator
            to gate any LangGraph node through Lelu with one line.
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">graph.py</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`from lelu import LeluClient
from lelu.langgraph import secure_node

client = LeluClient(
    base_url="http://localhost:8083",  # the engine you run
    api_key=os.environ["LELU_API_KEY"],
)

@secure_node(
    client=client,
    actor="billing_agent",
    action="invoice:approve",
    confidence_key="confidence",  # key in state dict
)
async def approve_invoice(state: dict) -> dict:
    # Only runs when Lelu returns allowed=True
    return {**state, "approved": True}`}</pre>
          </div>
        </section>

        {/* AuthDecision fields */}
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">AuthDecision fields</h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Field</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {[
                  ["decision", "str", "\"allow\" | \"deny\" | \"human_review\" | \"compute\""],
                  ["allowed", "bool", "True when decision == \"allow\""],
                  ["requires_human_review", "bool", "True when decision == \"human_review\""],
                  ["computed", "bool", "True when decision == \"compute\""],
                  ["safe_tool", "str | None", "Safe alternative tool (compute only)"],
                  ["safe_args", "dict | None", "Replacement args (compute only)"],
                  ["reason", "str", "Human-readable explanation"],
                  ["review_id", "str | None", "Review queue ID (human_review only) — pass it, or the decision itself, to wait_and_redeem() / redeem_review() / get_review()"],
                  ["request_id", "str", "Trace ID for the audit trail — not a review queue key"],
                  ["downgraded_scope", "str | None", "Set when the engine downgraded the requested scope"],
                ].map(([field, type_, desc]) => (
                  <tr key={field} className="bg-white dark:bg-zinc-900/30">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-900 dark:text-white">{field}</td>
                    <td className="px-4 py-3 font-mono text-xs text-violet-600 dark:text-violet-400">{type_}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* PyPI */}
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2">Package</h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            Available on PyPI as{" "}
            <a href="https://pypi.org/project/lelu-agent-auth-sdk/" target="_blank" rel="noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline font-mono text-sm">
              lelu-agent-auth-sdk
            </a>
            . Requires Python 3.11 or later.
          </p>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a href="/docs/integrations/typescript"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          TypeScript SDK
        </a>
        <a href="/docs/integrations/vercel-ai"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Vercel AI SDK
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
}
