import { TryInSandbox } from "@/components/docs/TryInSandbox";

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
          <div className="mb-4">
            <TryInSandbox tool="transfer_funds" context="amount=500 to=account_xyz" />
          </div>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Claude returns <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">tool_use</code> blocks when it wants to call a tool.
            Pass the tool name, with its input as <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">args</code>, to Lelu before dispatching.
          </p>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Send an <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">actor</code> listed in your policy&apos;s 
            <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">agent_scopes</code>; a default engine denies an unknown actor (&quot;unknown
            agent scope&quot;). Anthropic does not expose token log-probs, so Claude responses carry no
            verified confidence signal (<code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">LeluClient.signalFrom.anthropic()</code> always
            returns <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">null</code>). Leave the signal out and the engine applies 
            <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">CONFIDENCE_MISSING_MODE</code>. Its default, <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">deny</code>,
            refuses every call (&quot;no confidence signal detected&quot;). These examples assume the
            engine runs with <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">CONFIDENCE_MISSING_MODE=review</code>, which is what 
            <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">npx lelu-mcp start</code> sets: calls the policy doesn&apos;t deny go to a
            human reviewer. Don&apos;t send a self-reported <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">confidence</code> number
            instead; the hosted cloud and a default engine ignore it.
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">agent.ts</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "lelu-agent-auth";

const claude = new Anthropic();
// The engine to call. An API key alone does not select one: with no baseUrl
// (and no LELU_BASE_URL) the SDK uses the engine \`npx lelu-mcp start\` runs,
// else http://localhost:8080.
const lelu = createClient({
  baseUrl: process.env.LELU_BASE_URL,
  apiKey: process.env.LELU_API_KEY,
});

const response = await claude.messages.create({
  model: "claude-opus-4-5",
  max_tokens: 1024,
  tools,
  messages,
});

for (const block of response.content) {
  if (block.type !== "tool_use") continue;

  const request = {
    tool: block.name,
    actor: "support-agent", // an agent listed in your policy's agent_scopes
    // Tool arguments go in args (an object), not in context.
    args: block.input as Record<string, unknown>,
    // No context.signal: Claude exposes no log-probs (see above).
  };
  const decision = await lelu.authorize(request);

  // Branch on decision, not on allowed.
  switch (decision.decision) {
    case "allow":
      await executeTool(block.name, block.input);
      break;

    case "compute":
      // Redirected: run the safe tool Lelu chose with its safe arguments,
      // never the original call. No safe tool means nothing safe to run.
      if (!decision.safeTool) {
        console.error(\`Blocked: \${block.name} was redirected without a safe tool\`);
        break;
      }
      await executeTool(decision.safeTool, decision.safeArgs ?? {});
      break;

    case "human_review": {
      // Waits on decision.reviewId (not requestId, the trace ID), then
      // re-checks this exact request against what the reviewer approved.
      const approval = await lelu.waitAndRedeem(decision, request, { timeoutMs: 5 * 60_000 });
      if (!approval.allowed) {
        console.error(\`Not approved: \${block.name} — \${approval.reason}\`);
        break;
      }
      await executeTool(block.name, block.input);
      break;
    }

    default: // "deny"
      console.error(\`Blocked: \${block.name} — \${decision.reason}\`);
  }
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

const lelu = createClient({
  baseUrl: process.env.LELU_BASE_URL,
  apiKey: process.env.LELU_API_KEY,
});

const agent = new Agent({
  model: "claude-opus-4-5",
  tools: [searchTool, writeTool, deleteRecordsTool],
  hooks: {
    // Returning nothing lets the original call run; only "allow" (or an
    // approved review) reaches that.
    beforeToolCall: async ({ tool, input }) => {
      const request = {
        tool: tool.name,
        actor: "records-agent", // an agent listed in your policy's agent_scopes
        args: input as Record<string, unknown>,
      };
      const decision = await lelu.authorize(request);

      switch (decision.decision) {
        case "allow":
          return;
        case "compute":
          // Never run the original call. Tell the model which safe tool to use.
          return {
            abort: true,
            reason: decision.safeTool
              ? \`Use \${decision.safeTool} with \${JSON.stringify(decision.safeArgs ?? {})} instead\`
              : "Redirected without a safe tool",
          };
        case "human_review": {
          // Pause until a reviewer decides, bound to this exact request.
          const approval = await lelu.waitAndRedeem(decision, request, { timeoutMs: 5 * 60_000 });
          if (approval.allowed) return;
          return { abort: true, reason: \`Not approved: \${approval.reason}\` };
        }
        default: // "deny"
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
LELU_BASE_URL=http://localhost:8083   # your engine; omit to use \`npx lelu-mcp start\`
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
