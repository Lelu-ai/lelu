export default function DocsOpenAI() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm font-medium mb-6">
          Integrations
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">OpenAI</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Gate OpenAI function calls and tool-use requests through Lelu before they execute.
          Works with the Assistants API, Chat Completions with tools, and the Agents SDK.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Installation</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">terminal</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300">{`npm install lelu-agent-auth openai`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Chat Completions with tool calls
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            After the model returns a <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">tool_calls</code> response,
            authorize each call through Lelu before executing the underlying function.
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">agent.ts</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`import OpenAI from "openai";
import { createClient } from "lelu-agent-auth";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const lelu = createClient({ apiKey: process.env.LELU_API_KEY! });

const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages,
  tools,
});

for (const call of response.choices[0].message.tool_calls ?? []) {
  const decision = await lelu.authorize({
    tool: call.function.name,
    context: call.function.arguments,
  });

  if (decision.decision === "deny") {
    throw new Error(\`Tool \${call.function.name} was denied: \${decision.reason}\`);
  }

  if (decision.decision === "human_review") {
    await waitForApproval(decision.requestId); // your approval flow
  }

  // safe to execute
  await dispatchTool(call);
}`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            OpenAI Agents SDK
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Wrap each tool in a Lelu guard using the <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">withLelu</code> helper.
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">agent.ts</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`import { Agent, tool } from "@openai/agents";
import { withLelu } from "lelu-agent-auth/openai";

const sendEmail = withLelu(
  tool({
    name: "send_email",
    description: "Send an email to a user",
    parameters: z.object({ to: z.string(), body: z.string() }),
    execute: async ({ to, body }) => sendMailActual(to, body),
  })
);

const agent = new Agent({ tools: [sendEmail] });`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Environment variables</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">.env</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300">{`OPENAI_API_KEY=sk-...
LELU_API_KEY=lelu_sk_...`}</pre>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a href="/docs/quickstart" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Previous: Quickstart
        </a>
        <a href="/docs/integrations/anthropic" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Next: Anthropic
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </a>
      </div>
    </div>
  );
}
