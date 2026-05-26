export default function DocsVercelAI() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium mb-6">
          Integrations
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">Vercel AI SDK</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Authorize tool calls in Vercel AI SDK streaming responses. Works with{" "}
          <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">streamText</code>,{" "}
          <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">generateText</code>, and the{" "}
          <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">tool()</code> helper.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Installation</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">terminal</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300">{`npm install lelu-agent-auth ai @ai-sdk/openai`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Wrap a tool with Lelu</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Use the <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">execute</code> function inside{" "}
            <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">tool()</code> to call Lelu before running the real logic.
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">app/api/chat/route.ts</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`import { streamText, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "lelu-agent-auth";
import { z } from "zod";

const lelu = createClient({ apiKey: process.env.LELU_API_KEY! });

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: openai("gpt-4o"),
    messages,
    tools: {
      delete_record: tool({
        description: "Delete a record from the database",
        parameters: z.object({ id: z.string() }),
        execute: async ({ id }) => {
          const { decision, reason } = await lelu.authorize({
            tool: "delete_record",
            context: id,
          });

          if (decision === "deny") return { error: reason };
          if (decision === "human_review") return { pending: true };

          return await db.delete(id);
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Server Action pattern</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">app/actions.ts</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`"use server";
import { createClient } from "lelu-agent-auth";

const lelu = createClient({ apiKey: process.env.LELU_API_KEY! });

export async function runAgentAction(tool: string, input: unknown) {
  const { decision, reason } = await lelu.authorize({ tool });

  if (decision === "deny") throw new Error(\`Action blocked: \${reason}\`);
  if (decision === "human_review") return { status: "pending" };

  return { status: "ok", result: await dispatch(tool, input) };
}`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Environment variables</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">.env.local</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300">{`LELU_API_KEY=lelu_sk_...
OPENAI_API_KEY=sk-...`}</pre>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a href="/docs/integrations/mcp" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Previous: MCP
        </a>
        <a href="/docs/integrations/go" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Next: Go SDK
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </a>
      </div>
    </div>
  );
}
