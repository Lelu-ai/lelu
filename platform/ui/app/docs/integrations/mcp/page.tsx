export default function DocsMCP() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 text-sm font-medium mb-6">
          Integrations
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">MCP</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Gate Model Context Protocol tool calls through Lelu. Works as a middleware between
          any MCP client (Claude Desktop, Claude Code, custom hosts) and your MCP server.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">How it works</h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            Lelu&apos;s MCP proxy sits between the client and your server. Every{" "}
            <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">tools/call</code>{" "}
            request is forwarded to the Lelu authorize endpoint before reaching your handler.
            Denied calls never reach your server. Calls that require human review are held until
            approved.
          </p>
          <div className="mt-4 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 font-mono text-sm text-zinc-600 dark:text-zinc-400">
            MCP client → Lelu proxy → your MCP server
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Using the hosted proxy</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Point your MCP client at the Lelu-managed proxy URL instead of your server directly.
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">claude_desktop_config.json</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`{
  "mcpServers": {
    "my-server": {
      "url": "https://mcp.lelu-ai.com/proxy",
      "headers": {
        "X-Lelu-Key": "lelu_sk_...",
        "X-Target-URL": "http://localhost:3001"
      }
    }
  }
}`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Self-hosted middleware</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Embed Lelu authorization directly in your MCP server using the SDK.
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">server.ts</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient } from "lelu-agent-auth";

const lelu = createClient({ apiKey: process.env.LELU_API_KEY! });
const server = new McpServer({ name: "my-server", version: "1.0.0" });

server.tool("delete_file", { path: z.string() }, async ({ path }) => {
  const { decision, reason } = await lelu.authorize({ tool: "delete_file" });

  if (decision === "deny") {
    return { content: [{ type: "text", text: \`Blocked: \${reason}\` }] };
  }

  await fs.unlink(path);
  return { content: [{ type: "text", text: \`Deleted \${path}\` }] };
});`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Policy example</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Create a policy in the dashboard that targets your MCP tool names:
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">Policy rules</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`deny   delete_file      — Never allow file deletion via MCP
review send_email       — Require human approval before sending
allow  read_file        — Read-only ops are always fine`}</pre>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a href="/docs/integrations/langgraph" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Previous: LangGraph
        </a>
        <a href="/docs/integrations/vercel-ai" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Next: Vercel AI SDK
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </a>
      </div>
    </div>
  );
}
