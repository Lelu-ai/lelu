export default function DocsConceptClient() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-sm font-medium mb-6">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          Concepts
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">Client SDKs</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Lelu offers official client SDKs for TypeScript, Python, and Go. These SDKs provide a type-safe, ergonomic way to interact with the Lelu Engine from agents and backend services.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Why use the SDK?</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            While you can call the REST API directly, the SDKs handle several complex tasks automatically:
          </p>
          <ul className="list-disc list-inside space-y-2 text-zinc-600 dark:text-zinc-400 mb-6 ml-2">
            <li><strong>Long-polling:</strong> Automatically waits for human approval when a request is queued.</li>
            <li><strong>Type Safety:</strong> Full TypeScript definitions and Python type hints.</li>
            <li><strong>Retries:</strong> Built-in exponential backoff for network failures.</li>
            <li><strong>Framework Integrations:</strong> Drop-in middleware for LangChain, AutoGPT, and Express.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">TypeScript SDK</h2>
          
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">Installation</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300">
              {`npm install @lelu-auth/lelu`}
            </pre>
          </div>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">Usage</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              {`import { LeluClient } from "@lelu-auth/lelu";

const lelu = new LeluClient({
  baseUrl: "http://localhost:8082",
  apiKey: process.env.LELU_API_KEY,
});

// This call will block if human approval is required
const decision = await lelu.authorize({
  action: "delete_user",
  confidence: 0.75,
  waitForApproval: true // Default is true
});

if (decision.allowed) {
  console.log("Action approved!");
}`}
            </pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Python SDK</h2>
          
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">Installation</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300">
              {`pip install lelu-agent-auth-sdk`}
            </pre>
          </div>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">Usage</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              {`from lelu import LeluClient

lelu = LeluClient(
    base_url="http://localhost:8082",
    api_key="YOUR_API_KEY"
)

decision = lelu.authorize(
    action="delete_user",
    confidence=0.75
)

if decision.requires_human_review:
    # Block until the human clicks Approve/Deny in the UI
    decision.wait()

if decision.allowed:
    print("Action approved!")`}
            </pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Go SDK</h2>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">Installation</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
{`go get github.com/lelu-auth/lelu/sdk/go`}
            </pre>
          </div>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">Usage</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
{`package main

import (
  "context"
  "fmt"

  lelu "github.com/lelu-auth/lelu/sdk/go"
)

func main() {
  client := lelu.NewClient(lelu.ClientConfig{
    BaseURL: "http://localhost:8082",
    APIKey:  "your-api-key",
  })

  decision, err := client.AgentAuthorize(context.Background(), lelu.AgentAuthRequest{
    Actor:      "invoice_bot",
    Action:     "approve_refunds",
    Confidence: 0.92,
    ActingFor:  "user_123",
  })
  if err != nil {
    panic(err)
  }

  fmt.Println("allowed:", decision.Allowed, "reason:", decision.Reason)
}`}
            </pre>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                <tr>
                  <th className="text-left px-4 py-3 text-zinc-700 dark:text-zinc-300 font-medium">Method</th>
                  <th className="text-left px-4 py-3 text-zinc-700 dark:text-zinc-300 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-white/10">
                <tr>
                  <td className="px-4 py-3 font-mono text-zinc-900 dark:text-zinc-100">Authorize</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">Human authorization via <span className="font-mono">/v1/authorize</span></td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-zinc-900 dark:text-zinc-100">AgentAuthorize</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">Confidence-aware agent authorization via <span className="font-mono">/v1/agent/authorize</span></td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-zinc-900 dark:text-zinc-100">MintToken</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">Mint JIT token via <span className="font-mono">/v1/tokens/mint</span></td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-zinc-900 dark:text-zinc-100">RevokeToken</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">Revoke token via <span className="font-mono">DELETE /v1/tokens/{"{id}"}</span></td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-zinc-900 dark:text-zinc-100">IsHealthy</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">Engine health check via <span className="font-mono">/healthz</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a href="/docs/concepts/api" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Previous: API
        </a>
        <a href="/docs/concepts/cli" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Next: CLI &amp; MCP
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
      </div>
    </div>
  );
}
