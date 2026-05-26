export default function DocsLangGraph() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-sm font-medium mb-6">
          Integrations
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">LangGraph</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Add authorization checkpoints to LangGraph workflows. Gate tool nodes, interrupt
          on human review, and resume graphs after approval.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Installation</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">terminal</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300">{`npm install lelu-agent-auth @langchain/langgraph`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Authorization node</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Add a Lelu node before any tool node to gate execution. The node reads the pending
            tool call from state, evaluates it, and routes to <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">execute</code>, <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">block</code>, or <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">review</code>.
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">graph.ts</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`import { StateGraph, Annotation } from "@langchain/langgraph";
import { createClient } from "lelu-agent-auth";

const lelu = createClient({ apiKey: process.env.LELU_API_KEY! });

const State = Annotation.Root({
  tool: Annotation<string>(),
  context: Annotation<string>(),
  decision: Annotation<string>(),
  result: Annotation<string>(),
});

async function leluGuard(state: typeof State.State) {
  const { decision, reason } = await lelu.authorize({
    tool: state.tool,
    context: state.context,
  });
  return { decision, reason };
}

const graph = new StateGraph(State)
  .addNode("agent", agentNode)
  .addNode("lelu_guard", leluGuard)
  .addNode("execute_tool", executeToolNode)
  .addNode("blocked", blockedNode)
  .addEdge("agent", "lelu_guard")
  .addConditionalEdges("lelu_guard", (s) => s.decision, {
    allow: "execute_tool",
    deny: "blocked",
    human_review: "execute_tool", // interrupted for approval
  })
  .compile({ interruptBefore: ["execute_tool"] }); // pause for human review`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Resume after approval</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">approve.ts</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`// After human approves in your dashboard:
await graph.updateState(threadId, { decision: "allow" });
await graph.invoke(null, { configurable: { thread_id: threadId } });`}</pre>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a href="/docs/integrations/langchain" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Previous: LangChain
        </a>
        <a href="/docs/integrations/mcp" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Next: MCP
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </a>
      </div>
    </div>
  );
}
