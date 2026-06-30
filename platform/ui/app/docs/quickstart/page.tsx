const CLOUD_URL = "https://lelu-ai.com";

export default function DocsQuickStart() {
  return (
    <div className="w-full">
      {/* Title block */}
      <div className="mb-8">
        <h1
          id="quickstart"
          className="text-[34px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white leading-tight mb-3"
        >
          Quickstart
        </h1>
        <p className="text-[15px] text-[#737373] leading-relaxed">
          Authorize your first agent action in under 2 minutes — no Docker, no server setup.
        </p>
      </div>

      <hr className="border-[#E7E5E4] dark:border-[#27272A] mb-10" />

      <div className="space-y-14">
        {/* Step 1 — API key */}
        <section>
          <div className="flex gap-5 mb-5">
            <div className="flex-none w-8 h-8 rounded-full border border-[#E7E5E4] dark:border-[#27272A] flex items-center justify-center text-[13px] font-semibold text-[#0A0A0A] dark:text-white shrink-0 mt-0.5">
              1
            </div>
            <h2
              id="get-api-key"
              className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white pt-0.5"
            >
              Get an API key
            </h2>
          </div>
          <div className="pl-13 ml-13">
            <p className="text-[15px] text-[#737373] leading-[1.65] mb-5 ml-[52px]">
              Visit{" "}
              <a
                href="/api-key"
                className="text-[#0A0A0A] dark:text-white underline underline-offset-2 hover:opacity-70 transition-opacity"
              >
                lelu-ai.com/api-key
              </a>{" "}
              , create a free account, and click <strong className="text-[#0A0A0A] dark:text-white font-semibold">Create API key</strong>. The free tier includes 500
              requests/day.
            </p>
            <div className="ml-[52px]">
              <div className="flex gap-3 p-4 rounded-md bg-emerald-50 dark:bg-emerald-900/10 border-l-[3px] border-emerald-500">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-emerald-500 shrink-0 mt-0.5"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <p className="text-[14px] text-[#0A0A0A] dark:text-[#FAFAFA] leading-relaxed">
                  Copy the key and store it as{" "}
                  <code className="font-mono text-[13px] px-1.5 py-0.5 bg-[#F5F5F4] dark:bg-[#141416] border border-[#E7E5E4] dark:border-[#27272A] rounded">
                    LELU_API_KEY
                  </code>{" "}
                  in your <code className="font-mono text-[13px] px-1.5 py-0.5 bg-[#F5F5F4] dark:bg-[#141416] border border-[#E7E5E4] dark:border-[#27272A] rounded">.env</code> file. Never commit it to version control.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Step 2 — Install */}
        <section>
          <div className="flex gap-5 mb-5">
            <div className="flex-none w-8 h-8 rounded-full border border-[#E7E5E4] dark:border-[#27272A] flex items-center justify-center text-[13px] font-semibold text-[#0A0A0A] dark:text-white shrink-0 mt-0.5">
              2
            </div>
            <h2
              id="install"
              className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white pt-0.5"
            >
              Install the SDK
            </h2>
          </div>
          <div className="ml-[52px]">
            <p className="text-[15px] text-[#737373] leading-[1.65] mb-4">
              Add <code className="font-mono text-[13px] px-1.5 py-0.5 bg-[#F5F5F4] dark:bg-[#141416] border border-[#E7E5E4] dark:border-[#27272A] rounded">lelu-agent-auth</code> to your project:
            </p>
            <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#27272A] text-sm">
              <div className="px-4 py-2 bg-[#F5F5F4] dark:bg-[#141416] border-b border-[#E7E5E4] dark:border-[#27272A]">
                <span className="text-[12px] text-[#737373] font-mono">terminal</span>
              </div>
              <pre className="p-4 bg-white dark:bg-[#0B0B0C] font-mono text-[13px] text-[#0A0A0A] dark:text-[#E4E4E7] overflow-x-auto">
{`npm install lelu-agent-auth
# or: pnpm add lelu-agent-auth  |  yarn add lelu-agent-auth`}
              </pre>
            </div>
          </div>
        </section>

        {/* Step 3 — Connect */}
        <section>
          <div className="flex gap-5 mb-5">
            <div className="flex-none w-8 h-8 rounded-full border border-[#E7E5E4] dark:border-[#27272A] flex items-center justify-center text-[13px] font-semibold text-[#0A0A0A] dark:text-white shrink-0 mt-0.5">
              3
            </div>
            <h2
              id="connect"
              className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white pt-0.5"
            >
              Connect and authorize
            </h2>
          </div>
          <div className="ml-[52px]">
            <p className="text-[15px] text-[#737373] leading-[1.65] mb-4">
              Pass your API key to <code className="font-mono text-[13px] px-1.5 py-0.5 bg-[#F5F5F4] dark:bg-[#141416] border border-[#E7E5E4] dark:border-[#27272A] rounded">createClient</code>. The SDK routes to the live cloud engine automatically — no server to start.
            </p>
            <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#27272A] text-sm mb-5">
              <div className="px-4 py-2 bg-[#F5F5F4] dark:bg-[#141416] border-b border-[#E7E5E4] dark:border-[#27272A]">
                <span className="text-[12px] text-[#737373] font-mono">TypeScript</span>
              </div>
              <pre className="p-4 bg-white dark:bg-[#0B0B0C] font-mono text-[13px] text-[#0A0A0A] dark:text-[#E4E4E7] leading-relaxed overflow-x-auto">
{`import { createClient } from "lelu-agent-auth";

const lelu = createClient({
  apiKey: process.env.LELU_API_KEY,  // routes to cloud automatically
});

const decision = await lelu.agentAuthorize({
  actor: "billing-agent",
  action: "refund:process",
  resource: { orderId: "ord_123" },
  context: { confidence: 0.85 },
});

if (decision.allowed) {
  // proceed with the action
} else if (decision.requiresHumanReview) {
  // queued — agent pauses, awaiting human approval
} else {
  throw new Error(\`Denied: \${decision.reason}\`);
}`}
              </pre>
            </div>

            <p className="text-[15px] text-[#737373] leading-[1.65] mb-3">
              Or call the REST API directly:
            </p>
            <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#27272A] text-sm">
              <div className="px-4 py-2 bg-[#F5F5F4] dark:bg-[#141416] border-b border-[#E7E5E4] dark:border-[#27272A]">
                <span className="text-[12px] text-[#737373] font-mono">bash</span>
              </div>
              <pre className="p-4 bg-white dark:bg-[#0B0B0C] font-mono text-[13px] text-[#0A0A0A] dark:text-[#E4E4E7] leading-relaxed overflow-x-auto">
{`curl -X POST ${CLOUD_URL}/v1/agent/authorize \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $LELU_API_KEY" \\
  -d '{
    "actor":      "billing-agent",
    "action":     "refund:process",
    "resource":   { "orderId": "ord_123" },
    "confidence": 0.85
  }'`}
              </pre>
            </div>
          </div>
        </section>

        {/* Step 4 — Response */}
        <section>
          <div className="flex gap-5 mb-5">
            <div className="flex-none w-8 h-8 rounded-full border border-[#E7E5E4] dark:border-[#27272A] flex items-center justify-center text-[13px] font-semibold text-[#0A0A0A] dark:text-white shrink-0 mt-0.5">
              4
            </div>
            <h2
              id="response"
              className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white pt-0.5"
            >
              Read the response
            </h2>
          </div>
          <div className="ml-[52px]">
            <p className="text-[15px] text-[#737373] leading-[1.65] mb-4">
              The engine evaluates the request against your policy and returns one of three outcomes:
            </p>
            <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#27272A] text-sm mb-6">
              <div className="px-4 py-2 bg-[#F5F5F4] dark:bg-[#141416] border-b border-[#E7E5E4] dark:border-[#27272A]">
                <span className="text-[12px] text-[#737373] font-mono">json</span>
              </div>
              <pre className="p-4 bg-white dark:bg-[#0B0B0C] font-mono text-[13px] text-[#0A0A0A] dark:text-[#E4E4E7] leading-relaxed overflow-x-auto">
{`{
  "allowed":              true,
  "requires_human_review": false,
  "confidence_used":       0.85,
  "reason":               "Confidence threshold met",
  "trace_id":             "tr_7f30c2a4e1b8"
}`}
              </pre>
            </div>
            <dl className="space-y-3 text-[14px]">
              {[
                { field: "allowed: true", desc: "Action is permitted — proceed immediately." },
                {
                  field: "requires_human_review: true",
                  desc: "Confidence too low — action queued. Agent should poll /v1/queue/pending until approved or denied.",
                },
                {
                  field: "allowed: false",
                  desc: "Blocked by policy — do not proceed. Inspect reason for details.",
                },
              ].map((r) => (
                <div key={r.field} className="flex gap-3">
                  <code className="font-mono text-[12px] px-2 py-1 bg-[#F5F5F4] dark:bg-[#141416] border border-[#E7E5E4] dark:border-[#27272A] rounded shrink-0 h-fit">
                    {r.field}
                  </code>
                  <span className="text-[#737373] leading-relaxed">{r.desc}</span>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Step 5 — Framework integrations */}
        <section>
          <div className="flex gap-5 mb-5">
            <div className="flex-none w-8 h-8 rounded-full border border-[#E7E5E4] dark:border-[#27272A] flex items-center justify-center text-[13px] font-semibold text-[#0A0A0A] dark:text-white shrink-0 mt-0.5">
              5
            </div>
            <h2
              id="framework"
              className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white pt-0.5"
            >
              Add to your AI framework
            </h2>
          </div>
          <div className="ml-[52px]">
            <p className="text-[15px] text-[#737373] leading-[1.65] mb-4">
              Lelu ships framework wrappers so you can gate tool calls with one line:
            </p>
            <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#27272A] text-sm mb-5">
              <div className="flex items-center gap-1 px-3 py-2 bg-[#F5F5F4] dark:bg-[#141416] border-b border-[#E7E5E4] dark:border-[#27272A]">
                <span className="text-[12px] text-[#737373]">Vercel AI SDK</span>
              </div>
              <pre className="p-4 bg-white dark:bg-[#0B0B0C] font-mono text-[13px] text-[#0A0A0A] dark:text-[#E4E4E7] leading-relaxed overflow-x-auto">
{`import { secureTool } from "lelu-agent-auth/vercel";
import { tool } from "ai";
import { z } from "zod";

const processRefund = secureTool(lelu, "billing-agent", {
  tool: tool({
    description: "Process a customer refund",
    parameters: z.object({ orderId: z.string(), amount: z.number() }),
    execute: async ({ orderId, amount }) => ({ success: true }),
  }),
  action: "refund:process",
  confidence: 0.9,
});`}
              </pre>
            </div>
            <ul className="space-y-2 text-[14px]">
              {[
                { href: "/docs/integrations/langchain", label: "LangChain integration →" },
                { href: "/docs/integrations/vercel-ai", label: "Vercel AI SDK integration →" },
                { href: "/docs/integrations/mcp", label: "MCP server →" },
              ].map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="text-[#0A0A0A] dark:text-white font-medium hover:underline underline-offset-2"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      {/* Prev / Next */}
      <div className="flex justify-between items-center pt-10 mt-14 border-t border-[#E7E5E4] dark:border-[#27272A]">
        <a
          href="/docs"
          className="flex items-center gap-2 text-[14px] font-medium text-[#0A0A0A] dark:text-white hover:opacity-70 transition-opacity"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Introduction
        </a>
        <a
          href="/docs/installation"
          className="flex items-center gap-2 text-[14px] font-medium text-[#0A0A0A] dark:text-white hover:opacity-70 transition-opacity"
        >
          Installation
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
}
