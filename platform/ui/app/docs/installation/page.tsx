"use client";

import { useState } from "react";

export default function DocsInstallation() {
  const [packageTab, setPackageTab] = useState<"npm" | "pnpm" | "yarn" | "bun">("npm");

  const steps = [
    { num: 1, title: "Install the Package" },
    { num: 2, title: "Set Environment Variables" },
    { num: 3, title: "Configure Lelu Client" },
    { num: 4, title: "That's it!" },
  ];

  const packageCommands: Record<typeof packageTab, string> = {
    npm: "npm install @lelu-auth/lelu",
    pnpm: "pnpm add @lelu-auth/lelu",
    yarn: "yarn add @lelu-auth/lelu",
    bun: "bun add @lelu-auth/lelu",
  };

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">
          Installation
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-2xl">
          Install an official Lelu SDK, configure environment variables, and initialize the client in your app.
        </p>
      </div>

      {/* On-page step nav */}
      <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 mb-12">
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
          On this page
        </p>
        <ol className="space-y-1.5">
          {steps.map((s) => (
            <li key={s.num}>
              <a
                href={`#step-${s.num}`}
                className="inline-flex items-center gap-2.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </div>

      <div className="space-y-16">

        {/* Step 1 */}
        <section id="step-1">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-3">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black text-sm font-bold">
              1
            </span>
            Install the Package
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Let&apos;s start by adding Lelu to your project:
          </p>
          
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden group relative">
            <div className="flex items-center px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <div className="flex gap-2">
                <button onClick={() => setPackageTab("npm")} className={`px-3 py-1 text-xs rounded transition-colors ${packageTab === "npm" ? "bg-zinc-800 text-white font-medium" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}>
                  npm
                </button>
                <button onClick={() => setPackageTab("pnpm")} className={`px-3 py-1 text-xs rounded transition-colors ${packageTab === "pnpm" ? "bg-zinc-800 text-white font-medium" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}>
                  pnpm
                </button>
                <button onClick={() => setPackageTab("yarn")} className={`px-3 py-1 text-xs rounded transition-colors ${packageTab === "yarn" ? "bg-zinc-800 text-white font-medium" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}>
                  yarn
                </button>
                <button onClick={() => setPackageTab("bun")} className={`px-3 py-1 text-xs rounded transition-colors ${packageTab === "bun" ? "bg-zinc-800 text-white font-medium" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}>
                  bun
                </button>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 17l6-6-6-6M12 19h8"/>
                </svg>
                <span>terminal</span>
              </div>
              <pre className="font-mono text-sm text-zinc-300 overflow-x-auto">
                {packageCommands[packageTab]}
              </pre>
            </div>
            <button className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 p-2 bg-zinc-800 hover:bg-zinc-700 rounded transition-all" title="Copy to clipboard">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-400 hover:text-zinc-200">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
          </div>

          <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4 flex gap-3">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              If your frontend and backend are in separate repositories, install the Lelu SDK in each service that calls the Lelu Engine.
            </p>
          </div>
        </section>

        {/* Step 2 */}
        <section id="step-2">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-3">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black text-sm font-bold">
              2
            </span>
            Set Environment Variables
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Create a <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">.env</code> file in the root of your project and add the following environment variables:
          </p>

          <div className="space-y-6">
            {/* Secret Key */}
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold">
                  1
                </span>
                Lelu Engine URL
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                The URL where your Lelu Engine is running. This should point to your deployed Lelu Engine instance.
              </p>
              
              <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden group relative">
                <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
                  <span className="text-xs text-zinc-500 font-mono">.env</span>
                </div>
                <pre className="p-4 font-mono text-sm text-zinc-300">
                  LELU_ENGINE_URL=https://your-lelu-engine.example.com
                </pre>
                <button className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 p-2 bg-zinc-800 hover:bg-zinc-700 rounded transition-all" title="Copy to clipboard">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-400 hover:text-zinc-200">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* API Key */}
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold">
                  2
                </span>
                API Key
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                Your Lelu API key for authenticating requests to the engine. Generate a secure key using <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">openssl rand -base64 32</code>.
              </p>
              
              <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden group relative">
                <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
                  <span className="text-xs text-zinc-500 font-mono">.env</span>
                </div>
                <pre className="p-4 font-mono text-sm text-zinc-300">
                  LELU_API_KEY=your_secure_api_key_here
                </pre>
                <button className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 p-2 bg-zinc-800 hover:bg-zinc-700 rounded transition-all" title="Copy to clipboard">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-400 hover:text-zinc-200">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 flex gap-3">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div className="text-sm text-amber-800 dark:text-amber-300">
              <strong>Security notice:</strong> Never commit your API keys to version control. Add <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded font-mono">.env</code> to your <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded font-mono">.gitignore</code> file.
            </div>
          </div>
        </section>

        {/* Step 3 */}
        <section id="step-3">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-3">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black text-sm font-bold">
              3
            </span>
            Configure Lelu Client
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Initialize the Lelu client in your application to start authorizing agent actions:
          </p>
          
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden group relative">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">lib/lelu.ts</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 leading-loose overflow-x-auto">
              {`import { LeluClient } from "@lelu-auth/lelu";

export const lelu = new LeluClient({
  baseUrl: process.env.LELU_ENGINE_URL!,
  apiKey: process.env.LELU_API_KEY!,
});

// Example: Authorize an agent action
const decision = await lelu.agentAuthorize({
  actor: "support_agent",
  action: "issue_refund",
  context: { confidence: 0.85 }
});

if (decision.requiresHumanReview) {
  console.log("Action queued for human approval");
} else if (decision.allowed) {
  console.log("Action approved autonomously");
}`}
            </pre>
            <button className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 p-2 bg-zinc-800 hover:bg-zinc-700 rounded transition-all" title="Copy to clipboard">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-400 hover:text-zinc-200">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
          </div>

          <div className="mt-6 space-y-4">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              For Python applications:
            </p>
            <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden group relative">
              <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
                <span className="text-xs text-zinc-500 font-mono">lelu_client.py</span>
              </div>
              <pre className="p-4 font-mono text-sm text-zinc-300 leading-loose overflow-x-auto">
                {`from lelu import LeluClient
import os

lelu = LeluClient(
    base_url=os.environ["LELU_ENGINE_URL"],
    api_key=os.environ["LELU_API_KEY"]
)

# Example: Authorize an agent action
decision = lelu.agent_authorize(
    actor="support_agent",
    action="issue_refund",
    confidence=0.85
)

if decision.requires_human_review:
    print("Action queued for human approval")
elif decision.allowed:
    print("Action approved autonomously")`}
              </pre>
              <button className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 p-2 bg-zinc-800 hover:bg-zinc-700 rounded transition-all" title="Copy to clipboard">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-400 hover:text-zinc-200">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>
            </div>
          </div>
        </section>

        {/* Step 4 */}
        <section id="step-4">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-3">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-green-600 text-white text-sm font-bold">
              ✓
            </span>
            That&apos;s it!
          </h2>
          
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800/50 rounded-xl p-6">
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              You&apos;re all set! Lelu is now configured and ready to use. Check out the following resources to learn more:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a href="/docs/concepts/architecture" className="flex items-center gap-3 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600 dark:text-blue-400">
                    <path d="M12 2a10 10 0 1 0 10 10H12V2z"/>
                    <path d="M12 2v10l8.66 5"/>
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Architecture</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-500">Learn how Lelu works</div>
                </div>
              </a>
              <a href="/docs/integrations/nextjs" className="flex items-center gap-3 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-500/10 flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-600 dark:text-purple-400">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-zinc-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Integrations</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-500">Framework guides</div>
                </div>
              </a>
            </div>
          </div>
        </section>

      </div>

      {/* Prev / Next */}
      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a
          href="/docs"
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
          Previous: Introduction
        </a>
        <a
          href="/docs/concepts/architecture"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          Next: Architecture
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
