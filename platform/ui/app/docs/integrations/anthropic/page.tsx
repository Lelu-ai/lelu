export default function DocsAnthropic() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 text-sm font-medium mb-6">
          Integrations
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">Anthropic</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Authorize Claude tool use through Lelu before execution. Works with the Anthropic SDK,
          Claude API tool_use blocks, and the Claude Agent SDK.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Installation</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">terminal</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300">{`npm install lelu-agent-auth @anthropic-ai/sdk`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Tool use with Claude
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Claude returns <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">tool_use</code> blocks when it wants to call a tool.
            Pass the tool name to Lelu before dispatching.
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">agent.ts</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "lelu-agent-auth";

const claude = new Anthropic();
const lelu = createClient({ apiKey: process.env.LELU_API_KEY! });

const response = await claude.messages.create({
  model: "claude-opus-4-5",
  max_tokens: 1024,
  tools,
  messages,
});

for (const block of response.content) {
  if (block.type !== "tool_use") continue;

  const decision = await lelu.authorize({
    tool: block.name,
    context: JSON.stringify(block.input),
  });

  if (decision.decision === "deny") {
    console.error(\`Blocked: \${block.name} — \${decision.reason}\`);
    continue;
  }

  if (decision.decision === "human_review") {
    await requestApproval(decision.requestId);
  }

  await executeTool(block.name, block.input);
}`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Claude Agent SDK
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Use a pre-tool-call hook to intercept every tool invocation automatically.
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">agent.ts</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`import { Agent } from "@anthropic-ai/agent-sdk";
import { createClient } from "lelu-agent-auth";

const lelu = createClient({ apiKey: process.env.LELU_API_KEY! });

const agent = new Agent({
  model: "claude-opus-4-5",
  tools: [searchTool, writeTool, deleteRecordsTool],
  hooks: {
    beforeToolCall: async ({ tool, input }) => {
      const decision = await lelu.authorize({ tool: tool.name });
      if (decision.decision === "deny") {
        return { abort: true, reason: decision.reason };
      }
    },
  },
});`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Environment variables</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">.env</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300">{`ANTHROPIC_API_KEY=sk-ant-...
LELU_API_KEY=lelu_sk_...`}</pre>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a href="/docs/integrations/openai" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Previous: OpenAI
        </a>
        <a href="/docs/integrations/langchain" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Next: LangChain
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </a>
      </div>
    </div>
  );
}
