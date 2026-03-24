"use client";

import { useState } from "react";

export default function DocsCliCommands() {
  const [sdkTab, setSdkTab] = useState<"TypeScript" | "Python" | "Go">("TypeScript");

  const cliExamples: Record<typeof sdkTab, { install: string; commands: string }> = {
    TypeScript: {
      install: "npm install -g @lelu-auth/lelu",
      commands: `# Launch visual UI (Lelu Studio)
npx @lelu-auth/lelu studio

# Launch on custom port
npx @lelu-auth/lelu studio -p 4000

# View audit logs
npx @lelu-auth/lelu audit-log

# List all policies
npx @lelu-auth/lelu policies list

# View specific policy
npx @lelu-auth/lelu policies get auth

# Create/update policy from file
npx @lelu-auth/lelu policies set auth ./auth.rego

# Delete policy
npx @lelu-auth/lelu policies delete old-policy

# Show help
npx @lelu-auth/lelu help`
    },
    Python: {
      install: "pip install lelu-agent-auth-sdk",
      commands: `# Launch visual UI (Lelu Studio)
lelu studio

# Launch on custom port
lelu studio -p 4000

# View audit logs
lelu audit-log

# List all policies
lelu policies list

# View specific policy
lelu policies get auth

# Create/update policy from file
lelu policies set auth ./auth.rego

# Delete policy
lelu policies delete old-policy

# Show help
lelu help`
    },
    Go: {
      install: `go get github.com/lelu-auth/lelu/sdk/go
cd sdk/go/cmd/lelu && go build -o lelu`,
      commands: `# Launch visual UI (Lelu Studio)
./lelu studio

# Launch on custom port
./lelu studio -p 4000

# View audit logs
./lelu audit-log

# List all policies
./lelu policies list

# View specific policy
./lelu policies get auth

# Create/update policy from file
./lelu policies set auth ./auth.rego

# Delete policy
./lelu policies delete old-policy

# Show help
./lelu help`
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-sm font-medium mb-6">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17l6-6-6-6M12 19h8"/></svg>
          CLI Reference
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">CLI Commands</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Complete reference for the Lelu CLI commands available in all SDK packages. View audit logs and manage authorization policies directly from your terminal.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Installation</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            The CLI is included with all Lelu SDK packages. Choose your preferred language:
          </p>
          
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <div className="flex flex-wrap gap-2">
                  {(["TypeScript", "Python", "Go"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setSdkTab(tab)}
                      className={`px-3 py-1 text-xs rounded transition-colors ${
                        sdkTab === tab ? "bg-zinc-800 text-white font-medium" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              {cliExamples[sdkTab].install}
            </pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Available Commands</h2>
          
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <div className="flex flex-wrap gap-2">
                  {(["TypeScript", "Python", "Go"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setSdkTab(tab)}
                      className={`px-3 py-1 text-xs rounded transition-colors ${
                        sdkTab === tab ? "bg-zinc-800 text-white font-medium" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              {cliExamples[sdkTab].commands}
            </pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Command Reference</h2>
          
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Visual UI Command</h3>
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-500/5 dark:to-purple-500/5 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <path d="M3 9h18M9 21V9"/>
                  </svg>
                  <div>
                    <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">Lelu Studio</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-400 mb-2">
                      Launch a visual UI for managing policies and viewing audit logs. Works like Prisma Studio - just install and run! The UI is bundled in the npm package and starts immediately. No Docker required.
                    </p>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/10 mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5">
                      <th className="text-left px-4 py-3 font-semibold text-zinc-900 dark:text-white">Command</th>
                      <th className="text-left px-4 py-3 font-semibold text-zinc-900 dark:text-white">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                    {[
                      ["studio", "Launch visual UI (bundled in package, no Docker needed)"],
                      ["studio -p <port>", "Launch on custom port (default: 3002)"],
                      ["studio --no-browser", "Launch without opening browser"],
                      ["studio -b <browser>", "Open in specific browser (chrome, firefox, safari)"],
                      ["studio --docker", "Use Docker mode (starts all services with docker-compose)"],
                    ].map(([command, desc]) => (
                      <tr key={command}>
                        <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400 whitespace-nowrap">{command}</td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Audit Log Commands</h3>
              <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/10 mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5">
                      <th className="text-left px-4 py-3 font-semibold text-zinc-900 dark:text-white">Command</th>
                      <th className="text-left px-4 py-3 font-semibold text-zinc-900 dark:text-white">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                    <tr>
                      <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400 whitespace-nowrap">audit-log</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">View recent authorization events and audit trail data</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Policy Management Commands</h3>
              <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/10 mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5">
                      <th className="text-left px-4 py-3 font-semibold text-zinc-900 dark:text-white">Command</th>
                      <th className="text-left px-4 py-3 font-semibold text-zinc-900 dark:text-white">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                    {[
                      ["policies list", "List all policies with metadata"],
                      ["policies get <name>", "View a specific policy's content and details"],
                      ["policies set <name> <file>", "Create or update a policy from a Rego file"],
                      ["policies delete <name>", "Delete a policy by name"],
                    ].map(([command, desc]) => (
                      <tr key={command}>
                        <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400 whitespace-nowrap">{command}</td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Environment Variables</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Configure CLI behavior using these environment variables:
          </p>
          
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
                  ["LELU_PLATFORM_API_KEY", "platform-dev-key", "Platform API key for authentication"],
                  ["LELU_ENGINE_URL", "http://localhost:8083", "Engine API URL"],
                  ["LELU_TENANT_ID", "default", "Tenant ID for multi-tenant setups"],
                  ["LELU_AUDIT_LIMIT", "20", "Number of audit events to fetch"],
                  ["BROWSER", "-", "Browser to open Studio in (chrome, firefox, safari)"],
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
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Examples</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Launch Visual UI</h3>
              <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
                <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
                  <span className="text-xs text-zinc-500 font-mono">terminal</span>
                </div>
                <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
                  {`# Launch Lelu Studio (auto-starts with Docker)
lelu studio

# Launch on custom port
lelu studio -p 4000

# Launch without opening browser
lelu studio --no-browser

# Open in specific browser
lelu studio -b firefox
BROWSER=chrome lelu studio`}
                </pre>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Basic Usage</h3>
              <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
                <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
                  <span className="text-xs text-zinc-500 font-mono">terminal</span>
                </div>
                <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
                  {`# View recent audit events
lelu audit-log

# List all policies
lelu policies list

# View a specific policy
lelu policies get auth`}
                </pre>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Policy Management</h3>
              <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
                <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
                  <span className="text-xs text-zinc-500 font-mono">terminal</span>
                </div>
                <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
                  {`# Create a new policy from file
lelu policies set auth ./auth.rego

# Update existing policy
lelu policies set auth ./updated-auth.rego

# Delete policy
lelu policies delete old-policy`}
                </pre>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Custom Configuration</h3>
              <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
                <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
                  <span className="text-xs text-zinc-500 font-mono">terminal</span>
                </div>
                <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
                  {`# Use custom platform URL
LELU_PLATFORM_URL=https://your-platform.com lelu audit-log

# Use different tenant
LELU_TENANT_ID=prod lelu policies list

# Fetch more audit events
LELU_AUDIT_LIMIT=50 lelu audit-log`}
                </pre>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Error Handling</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            The CLI provides helpful error messages and troubleshooting guidance:
          </p>
          
          <div className="bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
              </svg>
              <div>
                <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">Platform Service Required</h4>
                <p className="text-sm text-blue-700 dark:text-blue-400 mb-2">
                  All CLI commands require the Lelu platform service to be running. If the service is not available, the CLI will:
                </p>
                <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1 ml-4">
                  <li>• Display clear error messages</li>
                  <li>• Provide Docker setup instructions</li>
                  <li>• Show the current connection URL</li>
                  <li>• Suggest troubleshooting steps</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a href="/docs/concepts/cli" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Previous: CLI & MCP
        </a>
        <a href="/docs/audit-trail" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Next: Audit Trail
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
      </div>
    </div>
  );
}