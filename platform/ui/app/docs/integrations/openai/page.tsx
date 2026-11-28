import { TryInSandbox } from "@/components/docs/TryInSandbox";

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
          <div className="mb-4">
            <TryInSandbox tool="send_email" context="to=user@example.com subject=Welcome" />
          </div>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            After the model returns a <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">tool_calls</code> response,
            authorize each call through Lelu before executing the underlying function.
          </p>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Two things a default engine needs, or it denies every call: an 
            <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">actor</code> listed in your policy&apos;s 
            <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">agent_scopes</code> (otherwise &quot;unknown agent scope&quot;), and a
            verified confidence signal (otherwise &quot;no confidence signal detected&quot;). Request
            the completion with <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">logprobs: true</code> and pass 
            <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">LeluClient.signalFrom.openai(response)</code> as 
            <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">context.signal</code>; the engine computes the confidence from the token
            log-probs itself. A bare <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">confidence</code> number is ignored unless the
            engine runs with <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">CONFIDENCE_ALLOW_UNVERIFIED=true</code>.
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">agent.ts</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`import OpenAI from "openai";
import { createClient, LeluClient } from "lelu-agent-auth";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// The engine to call. An API key alone does not select one: with no baseUrl
// (and no LELU_BASE_URL) the SDK uses the engine \`npx lelu-mcp start\` runs,
// else http://localhost:8080.
const lelu = createClient({
  baseUrl: process.env.LELU_BASE_URL,
  apiKey: process.env.LELU_API_KEY,
});

const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages,
  tools,
  logprobs: true, // lets the engine verify the model's confidence
});

// A verified confidence signal built from the token log-probs (null without them).
const signal = LeluClient.signalFrom.openai(response);

for (const call of response.choices[0].message.tool_calls ?? []) {
  if (call.type !== "function") continue;

  const request = {
    tool: call.function.name,
    actor: "support-agent", // an agent listed in your policy's agent_scopes
    // Tool arguments go in args; OpenAI returns them as a JSON string.
    args: JSON.parse(call.function.arguments),
    context: signal ? { signal } : {},
  };
  const decision = await lelu.authorize(request);

  // Branch on decision, not on allowed.
  switch (decision.decision) {
    case "allow":
      await dispatchTool(call);
      break;

    case "compute":
      // Redirected: run the safe tool Lelu chose with its safe arguments,
      // never the original call. No safe tool means nothing safe to run.
      if (!decision.safeTool) {
        throw new Error(\`Tool \${call.function.name} was redirected without a safe tool\`);
      }
      await dispatchTool({
        ...call,
        function: { name: decision.safeTool, arguments: JSON.stringify(decision.safeArgs ?? {}) },
      });
      break;

    case "human_review": {
      // Waits on decision.reviewId (not requestId, the trace ID), then
      // re-checks this exact request against what the reviewer approved.
      const approval = await lelu.waitAndRedeem(decision, request, { timeoutMs: 5 * 60_000 });
      if (!approval.allowed) {
        throw new Error(\`Tool \${call.function.name} was not approved: \${approval.reason}\`);
      }
      await dispatchTool(call);
      break;
    }

    default: // "deny"
      throw new Error(\`Tool \${call.function.name} was denied: \${decision.reason}\`);
  }
}`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            OpenAI Agents SDK
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Call Lelu at the top of each tool&apos;s <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">execute</code> function,
            before it does any work.
          </p>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Inside <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">execute</code> you don&apos;t have the model response, so there are no
            log-probs to send. Without a signal the engine applies 
            <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">CONFIDENCE_MISSING_MODE</code>: <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">deny</code> by default, so every
            call is refused. This example assumes the engine runs with 
            <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">CONFIDENCE_MISSING_MODE=review</code> (what 
            <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">npx lelu-mcp start</code> sets), which sends these calls to a reviewer. To
            authorize on the model&apos;s confidence instead, use Chat Completions with logprobs as
            above.
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">agent.ts</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`import { Agent, tool } from "@openai/agents";
import { createClient } from "lelu-agent-auth";
import { z } from "zod";

const lelu = createClient({
  baseUrl: process.env.LELU_BASE_URL,
  apiKey: process.env.LELU_API_KEY,
});

const sendEmail = tool({
  name: "send_email",
  description: "Send an email to a user",
  parameters: z.object({ to: z.string(), body: z.string() }),
  execute: async ({ to, body }) => {
    const decision = await lelu.authorize({
      tool: "send_email",
      actor: "mailer-agent", // an agent listed in your policy's agent_scopes
      args: { to, body },
    });

    switch (decision.decision) {
      case "allow":
        return sendMailActual(to, body);
      case "compute":
        // Run the safe tool with its safe args, never the original call.
        if (!decision.safeTool) return "Blocked: redirected without a safe tool";
        return runTool(decision.safeTool, decision.safeArgs ?? {});
      case "human_review":
        // Not run. Resume later with lelu.waitAndRedeem(decision.reviewId, sameRequest).
        return \`Awaiting approval (review id: \${decision.reviewId})\`;
      default: // "deny"
        return \`Blocked: \${decision.reason}\`;
    }
  },
});

const agent = new Agent({ name: "Mailer", tools: [sendEmail] });`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Environment variables</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">.env</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300">{`OPENAI_API_KEY=sk-...
LELU_BASE_URL=http://localhost:8083   # your engine; omit to use \`npx lelu-mcp start\`
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
