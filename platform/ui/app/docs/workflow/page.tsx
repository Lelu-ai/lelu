"use client";

import { useState } from "react";

export default function DocsWorkflow() {
  const [sdkTab, setSdkTab] = useState<"TypeScript" | "Python" | "Go">("TypeScript");

  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 text-sm font-medium mb-6">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
          Complete Workflow
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">
          Lelu Workflow Guide
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          A step-by-step guide to using Lelu, from installation to production. Think of this as your complete workflow loop.
        </p>
      </div>

      {/* Workflow Overview */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-500/5 dark:to-purple-500/5 border border-blue-200 dark:border-blue-500/20 rounded-2xl p-6 mb-12">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">🧭 The Lelu Loop</h2>
        <div className="space-y-2 text-zinc-700 dark:text-zinc-300">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📦</span>
            <span><strong>Install</strong> → Set up Lelu SDK</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">📝</span>
            <span><strong>Policy</strong> → Define authorization rules</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔧</span>
            <span><strong>Client</strong> → Initialize in your code</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <span><strong>Authorize</strong> → Check permissions</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎨</span>
            <span><strong>Studio</strong> → Visual debugger & monitor</span>
          </div>
        </div>
      </div>

      <div className="space-y-16">
        {/* Step 1: Install & Initialize */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
              1
            </div>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Install & Initialize</h2>
          </div>
          
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Start your project with Lelu:
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-4">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-3">
              <div className="flex gap-2">
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
            <pre className="p-4 font-mono text-sm text-zinc-300">
{sdkTab === "TypeScript" && `npm install @lelu-auth/lelu
npx @lelu-auth/lelu init`}
{sdkTab === "Python" && `pip install lelu-agent-auth-sdk
lelu init`}
{sdkTab === "Go" && `go get github.com/lelu-auth/lelu/sdk/go
lelu init`}
            </pre>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
            <h4 className="font-semibold text-zinc-900 dark:text-white mb-2">This creates:</h4>
            <div className="font-mono text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
              <div>📁 config/</div>
              <div className="ml-4">└── auth.rego</div>
              <div>📄 .env</div>
              <div>📄 docker-compose.yml</div>
            </div>
          </div>
        </section>

        {/* Step 2: Define Policies */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-lg">
              2
            </div>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Define Your Policies</h2>
          </div>

          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            This is the heart of Lelu. Define authorization rules using Rego or YAML.
          </p>

          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">Example Policy (config/auth.rego):</h3>
          
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-4">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">config/auth.rego</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 leading-relaxed">
{`package lelu.auth

# Allow high-confidence actions
allow {
    input.action == "delete_user"
    input.confidence >= 0.90
}

# Require human review for medium confidence
require_review {
    input.action == "delete_user"
    input.confidence >= 0.70
    input.confidence < 0.90
}

# Deny low confidence
deny {
    input.action == "delete_user"
    input.confidence < 0.70
}`}
            </pre>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4 flex gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              👉 You define your authorization rules as policies. These are your source of truth.
            </p>
          </div>
        </section>

        {/* Step 3: Upload Policies */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-lg">
              3
            </div>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Upload Policies to Platform</h2>
          </div>

          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Upload your policies to the Lelu platform:
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-4">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-3">
              <div className="flex gap-2">
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
            <pre className="p-4 font-mono text-sm text-zinc-300">
{sdkTab === "TypeScript" && `npx lelu policies set auth ./config/auth.rego`}
{sdkTab === "Python" && `lelu policies set auth ./config/auth.rego`}
{sdkTab === "Go" && `lelu policies set auth ./config/auth.rego`}
            </pre>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
            <h4 className="font-semibold text-zinc-900 dark:text-white mb-2">What happens:</h4>
            <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1 ml-4">
              <li>✓ Policy is validated</li>
              <li>✓ Uploaded to platform</li>
              <li>✓ Available for authorization checks</li>
            </ul>
          </div>
        </section>

        {/* Step 4: Initialize Client */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-lg">
              4
            </div>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Initialize Lelu Client</h2>
          </div>

          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Set up the client in your application:
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-4">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-3">
              <div className="flex gap-2">
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
            <pre className="p-4 font-mono text-sm text-zinc-300 leading-relaxed">
{sdkTab === "TypeScript" && `import { LeluClient } from "@lelu-auth/lelu";

export const lelu = new LeluClient({
  baseUrl: process.env.LELU_ENGINE_URL!,
  apiKey: process.env.LELU_API_KEY!,
});`}
{sdkTab === "Python" && `from lelu import LeluClient
import os

lelu = LeluClient(
    base_url=os.environ["LELU_ENGINE_URL"],
    api_key=os.environ["LELU_API_KEY"]
)`}
{sdkTab === "Go" && `package main

import (
    "os"
    "github.com/lelu-auth/lelu/sdk/go"
)

func main() {
    client := lelu.NewClient(
        os.Getenv("LELU_ENGINE_URL"),
        os.Getenv("LELU_API_KEY"),
    )
}`}
            </pre>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4 flex gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              👉 This gives you a typed API to check authorization in your code.
            </p>
          </div>
        </section>

        {/* Step 5: Use in Code */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-lg">
              5
            </div>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Use Lelu in Your Code</h2>
          </div>

          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Check authorization before executing sensitive actions:
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-4">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-3">
              <div className="flex gap-2">
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
            <pre className="p-4 font-mono text-sm text-zinc-300 leading-relaxed overflow-x-auto">
{sdkTab === "TypeScript" && `import { lelu } from './lib/lelu';

async function deleteUser(userId: string, confidence: number) {
  // Check authorization
  const decision = await lelu.agentAuthorize({
    actor: "ai-agent-123",
    action: "delete_user",
    resource: { userId },
    confidence: confidence,
  });

  if (decision.requiresHumanReview) {
    console.log("⏳ Queued for human approval");
    return { status: "pending_review" };
  }

  if (!decision.allowed) {
    console.log("❌ Action denied");
    return { status: "denied" };
  }

  // Execute the action
  console.log("✅ Action approved");
  await db.users.delete(userId);
  return { status: "completed" };
}`}
{sdkTab === "Python" && `from lelu import lelu

def delete_user(user_id: str, confidence: float):
    # Check authorization
    decision = lelu.agent_authorize(
        actor="ai-agent-123",
        action="delete_user",
        resource={"user_id": user_id},
        confidence=confidence
    )
    
    if decision.requires_human_review:
        print("⏳ Queued for human approval")
        return {"status": "pending_review"}
    
    if not decision.allowed:
        print("❌ Action denied")
        return {"status": "denied"}
    
    # Execute the action
    print("✅ Action approved")
    db.users.delete(user_id)
    return {"status": "completed"}`}
{sdkTab === "Go" && `package main

import (
    "fmt"
    "github.com/lelu-auth/lelu/sdk/go"
)

func deleteUser(client *lelu.Client, userID string, confidence float64) error {
    // Check authorization
    decision, err := client.AgentAuthorize(&lelu.AuthRequest{
        Actor:      "ai-agent-123",
        Action:     "delete_user",
        Resource:   map[string]interface{}{"userId": userID},
        Confidence: confidence,
    })
    if err != nil {
        return err
    }
    
    if decision.RequiresHumanReview {
        fmt.Println("⏳ Queued for human approval")
        return nil
    }
    
    if !decision.Allowed {
        fmt.Println("❌ Action denied")
        return fmt.Errorf("action denied")
    }
    
    // Execute the action
    fmt.Println("✅ Action approved")
    return db.Users.Delete(userID)
}`}
            </pre>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-lg p-4">
            <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2">👉 This replaces manual permission checks with policy-driven authorization</h4>
          </div>
        </section>

        {/* Step 6: Open Studio */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-lg">
              6
            </div>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Open Lelu Studio (Visual Debugger)</h2>
          </div>

          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Launch the visual UI to monitor and debug:
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-4">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-3">
              <div className="flex gap-2">
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
            <pre className="p-4 font-mono text-sm text-zinc-300">
{sdkTab === "TypeScript" && `npx lelu studio`}
{sdkTab === "Python" && `lelu studio`}
{sdkTab === "Go" && `lelu studio`}
            </pre>
          </div>

          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-500/5 dark:to-purple-500/5 border border-indigo-200 dark:border-indigo-500/20 rounded-xl p-6">
            <h4 className="font-semibold text-indigo-900 dark:text-indigo-300 mb-3">👉 Opens a browser UI where you can:</h4>
            <ul className="text-sm text-indigo-700 dark:text-indigo-400 space-y-2 ml-4">
              <li>✓ View authorization decisions in real-time</li>
              <li>✓ Edit and test policies</li>
              <li>✓ Review audit logs</li>
              <li>✓ Approve/deny queued actions</li>
              <li>✓ Debug authorization flows</li>
            </ul>
          </div>
        </section>

        {/* The Loop */}
        <section>
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-500/5 dark:to-purple-500/5 border-2 border-blue-300 dark:border-blue-500/30 rounded-2xl p-8">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-6 flex items-center gap-3">
              <span className="text-3xl">🔁</span>
              Full Workflow Summary
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              Here's the loop you'll repeat as you develop:
            </p>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">1</div>
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-white">Update policy file</div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">Edit <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">config/auth.rego</code></div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm shrink-0">2</div>
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-white">Upload policy</div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">npx lelu policies set auth ./config/auth.rego</code> (TypeScript)<br/>
                    <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">lelu policies set auth ./config/auth.rego</code> (Python/Go)
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-sm shrink-0">3</div>
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-white">Lelu validates & activates policy</div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">Policy is now live</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-sm shrink-0">4</div>
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-white">Use client in your code</div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">Call <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">lelu.agentAuthorize()</code></div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0">5</div>
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-white">Check results in Studio</div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">Visual debugger for monitoring</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Mental Model */}
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-6">🧠 Mental Model</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
              <h4 className="font-semibold text-zinc-900 dark:text-white mb-2">Policy Files</h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Your source of truth for authorization rules</p>
            </div>
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
              <h4 className="font-semibold text-zinc-900 dark:text-white mb-2">Upload Command</h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Applies policy changes to the platform</p>
            </div>
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
              <h4 className="font-semibold text-zinc-900 dark:text-white mb-2">Lelu Client</h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Talks to the authorization engine</p>
            </div>
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
              <h4 className="font-semibold text-zinc-900 dark:text-white mb-2">Lelu Studio</h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Visual debugger and monitor</p>
            </div>
          </div>
        </section>

        {/* Quick Reference */}
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-6">⚡ Quick Reference</h2>
          
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-3">
              <span className="text-xs text-zinc-500 font-mono">Common Commands</span>
              <div className="flex gap-2 ml-auto">
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
            <pre className="p-4 font-mono text-sm text-zinc-300 leading-relaxed">
{sdkTab === "TypeScript" && `# Initialize project
npx @lelu-auth/lelu init

# Upload policy
npx lelu policies set <name> <file>

# List policies
npx lelu policies list

# View policy
npx lelu policies get <name>

# Open Studio
npx lelu studio

# View audit logs
npx lelu audit-log`}
{sdkTab === "Python" && `# Initialize project
lelu init

# Upload policy
lelu policies set <name> <file>

# List policies
lelu policies list

# View policy
lelu policies get <name>

# Open Studio
lelu studio

# View audit logs
lelu audit-log`}
{sdkTab === "Go" && `# Initialize project
lelu init

# Upload policy
lelu policies set <name> <file>

# List policies
lelu policies list

# View policy
lelu policies get <name>

# Open Studio
lelu studio

# View audit logs
lelu audit-log`}
            </pre>
          </div>
        </section>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a href="/docs/quickstart" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Previous: Quickstart
        </a>
        <a href="/docs/cli-commands" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Next: CLI Commands
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </a>
      </div>
    </div>
  );
}
