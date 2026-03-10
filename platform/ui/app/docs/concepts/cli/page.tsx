"use client";

import { useState } from "react";

export default function DocsConceptCli() {
  const [quickTab, setQuickTab] = useState<"Cursor" | "Claude Code" | "Open Code" | "Manual">("Cursor");
  const [configTab, setConfigTab] = useState<"SSE (Docker)" | "stdio (npx)" | "Claude Code">("SSE (Docker)");

  const quickAddCommands: Record<typeof quickTab, string> = {
    Cursor: "npx @lelu/mcp add --cursor",
    "Claude Code": "npx @lelu/mcp add --claude",
    "Open Code": "npx @lelu/mcp add --open-code",
    Manual: "npx @lelu/mcp start --transport stdio --engine-url http://localhost:8083 --api-key YOUR_API_KEY",
  };

  const configSnippets: Record<typeof configTab, string> = {
    "SSE (Docker)": `{
  "mcpServers": {
    "lelu": {
      "url": "http://localhost:3003/sse"
    }
  }
}`,
    "stdio (npx)": `{
  "mcpServers": {
    "lelu": {
      "command": "npx",
      "args": ["@lelu/mcp", "start", "--transport", "stdio"],
      "env": {
        "LELU_ENGINE_URL": "http://localhost:8083",
        "LELU_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}`,
    "Claude Code": "claude mcp add --transport http lelu http://localhost:3003/sse",
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-sm font-medium mb-6">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          Concepts
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">CLI &amp; MCP</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          The Lelu CLI provides tools for local development, policy management, audit log viewing, and running the Model Context Protocol (MCP) server for seamless integration with AI assistants like Cursor and Claude.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Installation</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            The CLI is available in all three SDK packages. You can run it directly using <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">npx</code> or install it globally.
          </p>
          
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <div className="flex flex-wrap gap-2">
                  <button className="px-3 py-1 text-xs rounded bg-zinc-800 text-white font-medium">TypeScript</button>
                  <button className="px-3 py-1 text-xs rounded text-zinc-400">Python</button>
                  <button className="px-3 py-1 text-xs rounded text-zinc-400">Go</button>
                </div>
              </div>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300">
              {`# Install globally
npm install -g @lelu-auth/lelu

# Or run directly
npx @lelu-auth/lelu help`}
            </pre>
          </div>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <div className="flex flex-wrap gap-2">
                  <button className="px-3 py-1 text-xs rounded text-zinc-400">TypeScript</button>
                  <button className="px-3 py-1 text-xs rounded bg-zinc-800 text-white font-medium">Python</button>
                  <button className="px-3 py-1 text-xs rounded text-zinc-400">Go</button>
                </div>
              </div>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300">
              {`# Install via pip
pip install lelu-agent-auth-sdk

# Run CLI
lelu help`}
            </pre>
          </div>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <div className="flex flex-wrap gap-2">
                  <button className="px-3 py-1 text-xs rounded text-zinc-400">TypeScript</button>
                  <button className="px-3 py-1 text-xs rounded text-zinc-400">Python</button>
                  <button className="px-3 py-1 text-xs rounded bg-zinc-800 text-white font-medium">Go</button>
                </div>
              </div>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300">
              {`# Install Go module
go get github.com/lelu-auth/lelu/sdk/go

# Build and run CLI
cd sdk/go/cmd/lelu
go build -o lelu
./lelu help`}
            </pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">CLI Commands</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            The Lelu CLI provides commands for viewing audit logs and managing authorization policies directly from your terminal.
          </p>

          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Audit Log</h3>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            View recent authorization events and audit trail data from the platform service.
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">terminal</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              {`# View recent audit events
lelu audit-log

# Customize number of events
LELU_AUDIT_LIMIT=50 lelu audit-log

# Use custom platform URL
LELU_PLATFORM_URL=https://your-platform.com lelu audit-log`}
            </pre>
          </div>

          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Policy Management</h3>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Create, update, view, and delete authorization policies stored in the platform.
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">terminal</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              {`# List all policies
lelu policies list

# View a specific policy
lelu policies get auth

# Create or update a policy from file
lelu policies set auth ./auth.rego

# Delete a policy
lelu policies delete old-policy

# Use different tenant
LELU_TENANT_ID=prod lelu policies list`}
            </pre>
          </div>

          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Environment Variables</h3>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/10 mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5">
                  <th className="text-left px-4 py-3 font-semibold text-zinc-900 dark:text-white">Variable</th>
                  <th className="text-left px-4 py-3 font-semibold text-zinc-900 dark:text-white">Default</th>
                  <th className="text-left px-4 py-3 font-semibold text-zinc-900 dark:text-white">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                {[
                  ["LELU_PLATFORM_URL", "http://localhost:9091", "Platform API URL"],
                  ["LELU_PLATFORM_API_KEY", "platform-dev-key", "Platform API key"],
                  ["LELU_TENANT_ID", "default", "Tenant ID for multi-tenant setups"],
                  ["LELU_AUDIT_LIMIT", "20", "Number of audit events to fetch"],
                ].map(([variable, defaultVal, desc]) => (
                  <tr key={variable}>
                    <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400 whitespace-nowrap">{variable}</td>
                    <td className="px-4 py-3 font-mono text-zinc-500 dark:text-zinc-400 text-xs">{defaultVal}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
              </svg>
              <div>
                <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">Platform Service Required</h4>
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  The CLI commands require the Lelu platform service to be running. If the service is not available, the CLI will provide helpful Docker setup instructions.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Model Context Protocol (MCP)</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Lelu ships a standalone MCP server (<code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">@lelu/mcp</code>) that exposes policy-aware authorization tools over both stdio (for local AI clients) and HTTP/SSE (for networked or Docker deployments). When an AI assistant calls a tool, Lelu evaluates your Rego policy and can pause execution to request human approval.
          </p>

          {/* Docker (recommended) */}
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Docker (recommended)</h3>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            The MCP server is included in the Lelu <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">docker-compose.yml</code>. Start it alongside the engine:
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-4">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">terminal</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              {`docker compose up -d mcp

# Health check
curl http://localhost:3003/healthz
# {"status":"ok","service":"lelu-mcp"}

# SSE endpoint for AI clients
# http://localhost:3003/sse`}
            </pre>
          </div>

          <p className="text-zinc-600 dark:text-zinc-400 mb-6 text-sm">
            The container connects to the engine over the internal Docker network (<code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">http://engine:8080</code>) and is exposed on host port <strong>3003</strong>. Configure your API key via the <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">LELU_API_KEY</code> environment variable.
          </p>

          {/* npx / local */}
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">npx (local stdio)</h3>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            For local development with Cursor or Claude Desktop, run the MCP server directly via npx in stdio mode:
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">terminal</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              {`npx @lelu/mcp start --transport stdio \\
  --engine-url http://localhost:8083 \\
  --api-key YOUR_API_KEY`}
            </pre>
          </div>

          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Client setup</h3>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Use CLI quick-add for your client, or choose manual configuration for full control:
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-4">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <div className="flex flex-wrap gap-2">
                  {(["Cursor", "Claude Code", "Open Code", "Manual"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setQuickTab(tab)}
                      className={`px-3 py-1 text-xs rounded transition-colors ${
                        quickTab === tab ? "bg-zinc-800 text-white font-medium" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              {quickAddCommands[quickTab]}
            </pre>
          </div>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <div className="flex flex-wrap gap-2">
                  {(["SSE (Docker)", "stdio (npx)", "Claude Code"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setConfigTab(tab)}
                      className={`px-3 py-1 text-xs rounded transition-colors ${
                        configTab === tab ? "bg-zinc-800 text-white font-medium" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              {configSnippets[configTab]}
            </pre>
          </div>

          {/* Available tools */}
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Available MCP tools</h3>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/10 mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5">
                  <th className="text-left px-4 py-3 font-semibold text-zinc-900 dark:text-white">Tool</th>
                  <th className="text-left px-4 py-3 font-semibold text-zinc-900 dark:text-white">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                {[
                  ["lelu_agent_authorize", "Confidence-aware authorization for an AI agent action"],
                  ["lelu_authorize", "Authorize a human user action against the active policy"],
                  ["lelu_mint_token", "Issue a short-lived JIT token for a specific action"],
                  ["lelu_revoke_token", "Revoke a previously issued token"],
                  ["lelu_health", "Check that the Lelu engine is reachable"],
                ].map(([tool, desc]) => (
                  <tr key={tool}>
                    <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400 whitespace-nowrap">{tool}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Policy Testing</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            You can test your Rego policies locally before deploying them to the Platform.
          </p>
          
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">terminal</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              {`# Evaluate a policy against a mock request
lelu policy eval ./policy.rego \\
  --action "delete_db" \\
  --confidence 0.85

# Output:
# Result: requires_approval
# Reason: Confidence 0.85 is below threshold 0.95 for action 'delete_db'`}
            </pre>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a href="/docs/concepts/client" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Previous: Client SDK
        </a>
        <a href="/docs/confidence" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Next: Confidence Scores
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
      </div>
    </div>
  );
}
