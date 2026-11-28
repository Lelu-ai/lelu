export default function DocsIntegrationsNextjs() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 text-sm font-medium mb-6">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          Integrations
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">
          Next.js
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Integrate Lelu into a Next.js application using Route Handlers (App Router) or API Routes
          (Pages Router). This guide also covers adding the approval UI widget to your dashboard.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Installation
          </h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">terminal</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300">{`npm install lelu-agent-auth`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Route Handler (App Router)
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Gate a server action or route handler before executing a sensitive AI task.
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">app/api/agent-action/route.ts</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`import { createClient, LeluClient } from "lelu-agent-auth";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI();
// The engine to call. An API key alone does not select one.
const lelu = createClient({
  baseUrl: process.env.LELU_BASE_URL,
  apiKey: process.env.LELU_API_KEY,
});

export async function POST(request: Request) {
  const { prompt } = await request.json();

  // Ask the model on the server, so the confidence signal comes from the
  // model response itself and not from the browser.
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    tools,
    logprobs: true,
  });
  const call = completion.choices[0].message.tool_calls?.[0];
  if (!call || call.type !== "function") {
    return NextResponse.json({ status: "no_action" });
  }

  const signal = LeluClient.signalFrom.openai(completion);
  const decision = await lelu.authorize({
    tool: call.function.name, // \`tool\` is required
    actor: "support-agent",   // an agent listed in your policy's agent_scopes
    args: JSON.parse(call.function.arguments),
    context: signal ? { signal } : {},
  });

  switch (decision.decision) {
    case "allow":
      // Proceed with the action
      return NextResponse.json({ status: "allowed" });

    case "compute":
      // Run decision.safeTool with decision.safeArgs, never the original action.
      if (!decision.safeTool) {
        return NextResponse.json({ error: "Denied", reason: decision.reason }, { status: 403 });
      }
      return NextResponse.json({
        status: "redirected",
        safeTool: decision.safeTool,
        safeArgs: decision.safeArgs,
      });

    case "human_review":
      // 202 with the review handle. It is reviewId: requestId is only the
      // trace ID and is not a queue key. Resume with
      // lelu.waitAndRedeem(reviewId, sameRequest) once a reviewer decides.
      return NextResponse.json(
        { status: "pending", reviewId: decision.reviewId },
        { status: 202 }
      );

    default: // "deny"
      return NextResponse.json({ error: "Denied", reason: decision.reason }, { status: 403 });
  }
}`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Approval UI Component
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            The Lelu React SDK includes a pre-built{" "}
            <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">
              LeluApprovalUI
            </code>{" "}
            component you can embed in your admin dashboard. It polls the engine for pending
            approvals.
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">app/admin/approvals/page.tsx</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`"use client";
import { LeluApprovalUI } from "lelu-agent-auth/react";

export default function ApprovalsPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">Pending AI Approvals</h1>
      <LeluApprovalUI
        engineUrl={process.env.NEXT_PUBLIC_LELU_URL!}
        apiKey={process.env.NEXT_PUBLIC_LELU_KEY!}
        onApprove={(id) => console.log("approved", id)}
        onDeny={(id) => console.log("denied", id)}
      />
    </main>
  );
}`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Environment Variables
          </h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">.env.local</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 leading-loose">{`# Server-side (Engine API — keep secret)
LELU_BASE_URL=http://localhost:8083
LELU_API_KEY=your_engine_api_key

# Client-side (if using the approval UI widget)
NEXT_PUBLIC_LELU_URL=https://lelu-ai.com
NEXT_PUBLIC_LELU_KEY=your_public_key`}</pre>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a
          href="/docs/integrations/backend"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Previous: Backend
        </a>
        <a
          href="/docs/integrations/react"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          Next: React
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
}
