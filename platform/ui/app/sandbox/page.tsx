"use client";

import { useState } from "react";
import Link from "next/link";
import { LeluMark } from "@/components/ui/LeluMark";

type Decision = "allow" | "deny" | "human_review";

interface SandboxResponse {
  requestId: string;
  tool: string;
  context?: string;
  decision: Decision;
  reason: string;
  rule: string;
  latencyMs: number;
  timestamp: string;
}

interface Scenario {
  label: string;
  tool: string;
  context: string;
  expected: Decision;
}

const SCENARIOS: Scenario[] = [
  {
    label: "Read customer data",
    tool: "read_customer_profile",
    context: "User asked for their account summary",
    expected: "allow",
  },
  {
    label: "Query database",
    tool: "query_database",
    context: "Fetching order history for support ticket",
    expected: "allow",
  },
  {
    label: "Send email",
    tool: "send_email",
    context: "Notifying user their order shipped",
    expected: "human_review",
  },
  {
    label: "Transfer funds",
    tool: "transfer_funds",
    context: "Moving $4,200 to vendor account",
    expected: "human_review",
  },
  {
    label: "Delete all records",
    tool: "delete_all_records",
    context: "Clearing test data from production",
    expected: "deny",
  },
  {
    label: "Execute shell",
    tool: "execute_shell_command",
    context: "Running a cleanup script on the server",
    expected: "deny",
  },
];

const DECISION_CONFIG: Record<Decision, { label: string; color: string; bg: string; dot: string }> = {
  allow: {
    label: "ALLOW",
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40",
    dot: "bg-emerald-500",
  },
  deny: {
    label: "DENY",
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40",
    dot: "bg-red-500",
  },
  human_review: {
    label: "HUMAN REVIEW",
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40",
    dot: "bg-amber-500",
  },
};

export default function SandboxPage() {
  const [tool, setTool] = useState(SCENARIOS[0].tool);
  const [context, setContext] = useState(SCENARIOS[0].context);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SandboxResponse | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<SandboxResponse[]>([]);
  const [activeScenario, setActiveScenario] = useState(0);

  function loadScenario(i: number) {
    setActiveScenario(i);
    setTool(SCENARIOS[i].tool);
    setContext(SCENARIOS[i].context);
    setResult(null);
    setError("");
  }

  async function handleAuthorize() {
    if (!tool.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/sandbox/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: tool.trim(), context: context.trim() || undefined }),
      });
      const data: SandboxResponse = await res.json();
      if (!res.ok) {
        setError((data as unknown as { error: string }).error || "Request failed");
        return;
      }
      setResult(data);
      setHistory((prev) => [data, ...prev].slice(0, 10));
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  const curlSnippet = `curl -X POST https://lelu-ai.com/api/authorize \\
  -H "Authorization: Bearer lelu_sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tool": "${tool || "your_tool_name"}",
    "context": "${context || "optional context"}"
  }'`;

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B0B0C]">
      {/* Grid background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Nav */}
      <nav className="relative z-10 border-b border-[#E7E5E4] dark:border-[#222224] bg-white/80 dark:bg-[#0B0B0C]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <LeluMark size={18} />
            <span className="font-bold text-[15px] text-[#0A0A0A] dark:text-white" style={{ letterSpacing: "-0.02em" }}>
              lelu
            </span>
            <span className="text-[#A3A3A3] text-[13px] ml-1">/ sandbox</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/docs" className="text-[13px] text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white transition-colors">
              Docs
            </Link>
            <Link
              href="/register"
              className="px-3.5 py-1.5 text-[13px] font-semibold bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F4F4F5] dark:bg-[#27272A] text-[11px] font-semibold text-[#737373] uppercase tracking-widest mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live sandbox
          </div>
          <h1 className="text-[36px] font-bold tracking-[-0.03em] text-[#0A0A0A] dark:text-white mb-3">
            Try Lelu without an account
          </h1>
          <p className="text-[15px] text-[#737373] max-w-xl">
            Send a real authorization request and see how Lelu's policy engine decides — allow, deny,
            or route to human review. No install, no signup required.
          </p>
        </div>

        {/* Scenario chips */}
        <div className="flex flex-wrap gap-2 mb-8">
          {SCENARIOS.map((s, i) => {
            const cfg = DECISION_CONFIG[s.expected];
            return (
              <button
                key={i}
                onClick={() => loadScenario(i)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium border transition-all ${
                  activeScenario === i
                    ? "bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] border-transparent"
                    : "bg-white dark:bg-[#111113] border-[#E7E5E4] dark:border-[#222224] text-[#0A0A0A] dark:text-white hover:border-[#0A0A0A] dark:hover:border-white/30"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {s.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Request panel */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-[#111113] border border-[#E7E5E4] dark:border-[#222224] rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <h2 className="text-[13px] font-semibold text-[#737373] uppercase tracking-widest mb-5">
                Authorization Request
              </h2>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-[#737373]">Tool name</label>
                  <input
                    type="text"
                    value={tool}
                    onChange={(e) => { setTool(e.target.value); setActiveScenario(-1); }}
                    onKeyDown={(e) => e.key === "Enter" && handleAuthorize()}
                    placeholder="e.g. send_email, delete_records"
                    className="w-full h-10 px-3.5 rounded-lg border border-[#E7E5E4] dark:border-[#2A2A2C] bg-[#FAFAFA] dark:bg-[#18181B] text-[#0A0A0A] dark:text-white font-mono text-[13px] placeholder:text-[#A3A3A3] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20 dark:focus:ring-white/10 focus:border-[#0A0A0A] dark:focus:border-white/30 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-[#737373]">
                    Context <span className="text-[#A3A3A3] font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="What is the agent trying to do?"
                    rows={3}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#E7E5E4] dark:border-[#2A2A2C] bg-[#FAFAFA] dark:bg-[#18181B] text-[#0A0A0A] dark:text-white text-[13px] placeholder:text-[#A3A3A3] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20 dark:focus:ring-white/10 focus:border-[#0A0A0A] dark:focus:border-white/30 transition-all resize-none"
                  />
                </div>

                {error && (
                  <p className="text-[13px] text-red-500">{error}</p>
                )}

                <button
                  onClick={handleAuthorize}
                  disabled={loading || !tool.trim()}
                  className="w-full h-11 rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] text-[14px] font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Evaluating…
                    </>
                  ) : (
                    "Authorize Request"
                  )}
                </button>
              </div>
            </div>

            {/* curl snippet */}
            <div className="bg-[#0A0A0A] rounded-2xl p-5 overflow-hidden">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#737373] mb-3">Production API call</p>
              <pre className="text-[11px] text-[#A3A3A3] leading-relaxed whitespace-pre-wrap break-all font-mono">
                <span className="text-[#737373]">$ </span>
                {curlSnippet}
              </pre>
            </div>
          </div>

          {/* Response panel */}
          <div className="space-y-4">
            {result ? (
              <div className={`border rounded-2xl p-6 ${DECISION_CONFIG[result.decision].bg}`}>
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className={`text-[11px] font-bold uppercase tracking-widest mb-1 ${DECISION_CONFIG[result.decision].color}`}>
                      Decision
                    </div>
                    <div className={`text-[32px] font-bold tracking-[-0.02em] ${DECISION_CONFIG[result.decision].color}`}>
                      {DECISION_CONFIG[result.decision].label}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-[#A3A3A3] uppercase tracking-widest">Latency</div>
                    <div className="text-[18px] font-bold text-[#0A0A0A] dark:text-white">{result.latencyMs}ms</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="text-[11px] font-semibold text-[#A3A3A3] uppercase tracking-widest mb-1">Reason</div>
                    <p className="text-[13px] text-[#0A0A0A] dark:text-white leading-relaxed">{result.reason}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[11px] font-semibold text-[#A3A3A3] uppercase tracking-widest mb-1">Rule matched</div>
                      <code className="text-[11px] font-mono text-[#0A0A0A] dark:text-white">{result.rule}</code>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-[#A3A3A3] uppercase tracking-widest mb-1">Request ID</div>
                      <code className="text-[11px] font-mono text-[#0A0A0A] dark:text-white">{result.requestId}</code>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-[#111113] border border-[#E7E5E4] dark:border-[#222224] rounded-2xl p-6 flex flex-col items-center justify-center min-h-[200px] text-center">
                <div className="w-10 h-10 rounded-full bg-[#F4F4F5] dark:bg-[#27272A] flex items-center justify-center mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#A3A3A3]">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <p className="text-[13px] text-[#737373]">Press "Authorize Request" to see the decision</p>
              </div>
            )}

            {/* History */}
            {history.length > 1 && (
              <div className="bg-white dark:bg-[#111113] border border-[#E7E5E4] dark:border-[#222224] rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-[#E7E5E4] dark:border-[#222224]">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#A3A3A3]">Recent requests</span>
                </div>
                <div className="divide-y divide-[#F4F4F5] dark:divide-[#222224]">
                  {history.slice(1).map((h) => {
                    const cfg = DECISION_CONFIG[h.decision];
                    return (
                      <div key={h.requestId} className="px-5 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                          <span className="text-[12px] font-mono text-[#0A0A0A] dark:text-white truncate">{h.tool}</span>
                        </div>
                        <span className={`text-[11px] font-bold shrink-0 ml-3 ${cfg.color}`}>{cfg.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 bg-[#0A0A0A] dark:bg-[#111113] rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-[20px] font-bold text-white mb-1">Ready to protect your agents?</h3>
            <p className="text-[14px] text-[#737373]">Create an account to get your API key and configure real policies.</p>
          </div>
          <Link
            href="/register"
            className="shrink-0 px-6 py-3 bg-white text-[#0A0A0A] rounded-xl font-bold text-[14px] hover:bg-zinc-100 transition-colors"
          >
            Get started free
          </Link>
        </div>
      </main>
    </div>
  );
}
