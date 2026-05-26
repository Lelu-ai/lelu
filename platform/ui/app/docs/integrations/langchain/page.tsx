export default function DocsLangChain() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400 text-sm font-medium mb-6">
          Integrations
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">LangChain</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Add Lelu authorization to any LangChain agent or chain. Works with LangChain.js and
          LangChain Python via a tool wrapper that intercepts calls before execution.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Installation</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">terminal</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300">{`# JavaScript / TypeScript
npm install lelu-agent-auth langchain @langchain/openai

# Python
pip install lelu-agent-auth langchain langchain-openai`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">TypeScript — wrap a tool</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">tools/delete_record.ts</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`import { DynamicTool } from "@langchain/core/tools";
import { createClient } from "lelu-agent-auth";

const lelu = createClient({ apiKey: process.env.LELU_API_KEY! });

export const deleteRecord = new DynamicTool({
  name: "delete_record",
  description: "Permanently deletes a record from the database",
  func: async (input: string) => {
    const decision = await lelu.authorize({ tool: "delete_record", context: input });

    if (decision.decision === "deny") {
      return \`Blocked: \${decision.reason}\`;
    }
    if (decision.decision === "human_review") {
      return \`Awaiting approval (id: \${decision.requestId})\`;
    }

    return await actualDeleteRecord(input);
  },
});`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Python — BaseTool subclass</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">tools/delete_record.py</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`from langchain.tools import BaseTool
from lelu import Client

lelu = Client(api_key=os.environ["LELU_API_KEY"])

class DeleteRecordTool(BaseTool):
    name = "delete_record"
    description = "Permanently deletes a record"

    def _run(self, input: str) -> str:
        decision = lelu.authorize(tool="delete_record", context=input)

        if decision.decision == "deny":
            return f"Blocked: {decision.reason}"
        if decision.decision == "human_review":
            return f"Pending approval: {decision.request_id}"

        return actual_delete(input)`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Using in an agent</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">agent.ts</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`import { createOpenAIFunctionsAgent, AgentExecutor } from "langchain/agents";
import { ChatOpenAI } from "@langchain/openai";
import { deleteRecord } from "./tools/delete_record";

const llm = new ChatOpenAI({ model: "gpt-4o" });
const agent = await createOpenAIFunctionsAgent({ llm, tools: [deleteRecord], prompt });
const executor = new AgentExecutor({ agent, tools: [deleteRecord] });

await executor.invoke({ input: "Delete the user record for ID 42" });`}</pre>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a href="/docs/integrations/anthropic" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Previous: Anthropic
        </a>
        <a href="/docs/integrations/langgraph" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Next: LangGraph
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </a>
      </div>
    </div>
  );
}
