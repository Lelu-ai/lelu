export default function DocsQuickStart() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-sm font-medium mb-6">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          Quickstart
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">Get Started with Lelu</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Send your first confidence-aware authorization request and see the decision in seconds. This guide will walk you through starting the engine, making an API call, and using the SDK.
        </p>
      </div>

      <div className="space-y-12">
        {/* Step 1 */}
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-zinc-200 dark:bg-zinc-800 ml-4"></div>
          <div className="relative flex gap-6">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 z-10 ring-4 ring-white dark:ring-black">1</div>
            <div className="flex-1 pb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">Install and start Lelu</h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                The fastest way to get Lelu running is with our one-command setup. This installs the SDK and automatically starts all services with Docker.
              </p>
              <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
                <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
                  <span className="text-xs text-zinc-500 font-mono">terminal</span>
                </div>
                <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
                  <pre><code>{`# Install SDK and start all services
npm install @lelu-auth/lelu
npx @lelu-auth/lelu init`}</code></pre>
                </div>
                <div className="p-4 font-mono text-xs text-blue-400 border-t border-zinc-800">
                  <div>✨ This command will:</div>
                  <div>• Check if Docker is installed</div>
                  <div>• Download docker-compose.yml</div>
                  <div>• Start all services (engine, platform, UI, database)</div>
                  <div>• Open browser to <b>http://localhost:3002</b></div>
                </div>
              </div>
              <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-3 flex gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <div className="text-xs text-blue-800 dark:text-blue-300">
                  <p className="mb-1">💡 New: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded font-medium">lelu studio</code> now works like Prisma Studio!</p>
                  <p>Just run <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">npx lelu studio</code> and the UI opens immediately - no Docker required! The UI is bundled in the npm package.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-zinc-200 dark:bg-zinc-800 ml-4"></div>
          <div className="relative flex gap-6">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 z-10 ring-4 ring-white dark:ring-black">2</div>
            <div className="flex-1 pb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">Call the API</h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                Use the agent authorization endpoint and include a confidence score. In this example, the agent is 85% confident it should delete an S3 object.
              </p>
              <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
                <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
                  <span className="text-xs text-zinc-500 font-mono">bash</span>
                </div>
                <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
                  <pre><code>{`curl -X POST http://localhost:8083/v1/agent/authorize \\
  -H "Content-Type: application/json" \\
  -d '{
    "actor": "agent-123",
    "action": "s3:DeleteObject",
    "resource": { "bucket": "prod-data" },
    "confidence": 0.85,
    "acting_for": "user-42",
    "scope": "storage:write"
  }'`}</code></pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-zinc-200 dark:bg-zinc-800 ml-4"></div>
          <div className="relative flex gap-6">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 z-10 ring-4 ring-white dark:ring-black">3</div>
            <div className="flex-1 pb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">Inspect the decision</h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                The engine evaluates the request against your Rego policies. If the confidence meets the threshold, it's allowed. Otherwise, it might require human review.
              </p>
              <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
                <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
                  <span className="text-xs text-zinc-500 font-mono">json</span>
                </div>
                <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
                  <pre><code>{`{
  "allowed": true,
  "reason": "Confidence threshold met",
  "trace_id": "tr_7f30c2...",
  "requires_human_review": false,
  "confidence_used": 0.85
}`}</code></pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-zinc-200 dark:bg-zinc-800 ml-4"></div>
          <div className="relative flex gap-6">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 z-10 ring-4 ring-white dark:ring-black">4</div>
            <div className="flex-1 pb-8">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">View audit logs and manage policies</h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                Use the built-in CLI to view audit logs and manage policies directly from your terminal. The SDK was already installed in step 1.
              </p>
              <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
                <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
                  <span className="text-xs text-zinc-500 font-mono">terminal</span>
                </div>
                <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
                  <pre><code>{`# View audit logs
npx @lelu-auth/lelu audit-log

# Manage policies
npx @lelu-auth/lelu policies list
npx @lelu-auth/lelu policies get auth
npx @lelu-auth/lelu policies set auth ./auth.rego`}</code></pre>
                </div>
              </div>
              <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-3 flex gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  You can also view audit logs and manage policies in the Web UI at http://localhost:3002
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Step 5 */}
        <div className="relative">
          <div className="relative flex gap-6">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 z-10 ring-4 ring-white dark:ring-black">5</div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">Use the SDK</h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                For production applications, use our official SDKs to integrate Lelu directly into your codebase.
              </p>
              <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
                <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
                  <span className="text-xs text-zinc-500 font-mono">typescript</span>
                </div>
                <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
                  <pre><code>{`import { LeluClient } from "@lelu-auth/lelu";

const client = new LeluClient({
  baseUrl: "http://localhost:8083",
});

const decision = await client.agentAuthorize({
  actor: "agent-123",
  action: "s3:DeleteObject",
  resource: { bucket: "prod-data" },
  confidence: 0.85,
});`}</code></pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a href="/docs" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Previous: Introduction
        </a>
        <a href="/docs/installation" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Next: Installation
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
      </div>
    </div>
  );
}