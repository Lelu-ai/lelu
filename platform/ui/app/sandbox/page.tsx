"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

type Decision = "allow" | "deny" | "human_review" | "compute";

interface AuthResponse {
  requestId: string;
  tool: string;
  context?: string;
  args?: Record<string, unknown>;
  decision: Decision;
  reason: string;
  rule: string;
  latencyMs: number;
  mode: string;
  timestamp: string;
  safeTool?: string;
  safeArgs?: Record<string, unknown>;
}

interface HistoryItem {
  tool: string;
  decision: Decision;
  requestId: string;
}

interface Scenario {
  label: string;
  tool: string;
  context: string;
  args: string;
  expected: Decision;
}

const SANDBOX_KEY = "lelu_sk_sandbox_test";

const SCENARIOS: Scenario[] = [
  {
    label: "Read customer",
    tool: "read_customer_profile",
    context: "Fetching account summary for support ticket #4821",
    args: '{\n  "customer_id": "cust_abc123"\n}',
    expected: "allow",
  },
  {
    label: "Query database",
    tool: "query_database",
    context: "Looking up order history for last 30 days",
    args: '{\n  "table": "orders",\n  "limit": 50\n}',
    expected: "allow",
  },
  {
    label: "Send email",
    tool: "send_email",
    context: "Notifying user that their subscription is expiring",
    args: '{\n  "to": "user@example.com",\n  "subject": "Your subscription expires soon"\n}',
    expected: "human_review",
  },
  {
    label: "Transfer funds",
    tool: "transfer_funds",
    context: "Moving $4,200 to vendor account for invoice #INV-992",
    args: '{\n  "amount": 4200,\n  "currency": "USD",\n  "to_account": "vendor_992"\n}',
    expected: "human_review",
  },
  {
    label: "Delete records",
    tool: "delete_all_records",
    context: "Clearing stale test data from the users table",
    args: '{\n  "table": "users",\n  "filter": "is_test=true"\n}',
    expected: "deny",
  },
  {
    label: "Execute shell",
    tool: "execute_shell_command",
    context: "Running cleanup script on production server",
    args: '{\n  "command": "rm -rf /tmp/cache/*"\n}',
    expected: "deny",
  },
  {
    label: "Write file",
    tool: "write_file",
    context: "Saving updated config to production directory",
    args: '{\n  "path": "/prod/config.yaml",\n  "content": "timeout: 30s"\n}',
    expected: "compute",
  },
];

const DECISION_CONFIG = {
  allow: {
    label: "ALLOW",
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40",
    dot: "bg-emerald-500",
    badge: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
  },
  deny: {
    label: "DENY",
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40",
    dot: "bg-red-500",
    badge: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  },
  human_review: {
    label: "HUMAN REVIEW",
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40",
    dot: "bg-amber-500",
    badge: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  },
  compute: {
    label: "COMPUTE",
    color: "text-violet-700 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800/40",
    dot: "bg-violet-500",
    badge: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400",
  },
} as const;

function SandboxContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeScenario, setActiveScenario] = useState(0);
  const [tool, setTool] = useState(SCENARIOS[0].tool);
  const [context, setContext] = useState(SCENARIOS[0].context);
  const [argsText, setArgsText] = useState(SCENARIOS[0].args);
  const [argsError, setArgsError] = useState("");

  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AuthResponse | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [activeTab, setActiveTab] = useState<"response" | "raw">("response");

  // Pre-fill from URL params (?tool=delete_record&context=...)
  useEffect(() => {
    const t = searchParams.get("tool");
    const c = searchParams.get("context");
    if (t) {
      setTool(t);
      setContext(c ?? "");
      setArgsText("{}");
      setActiveScenario(-1);
    }
  }, [searchParams]);

  // Update URL when tool changes so the link is shareable
  useEffect(() => {
    if (!tool.trim()) return;
    const params = new URLSearchParams();
    params.set("tool", tool.trim());
    if (context.trim()) params.set("context", context.trim());
    router.replace(`/sandbox?${params.toString()}`, { scroll: false });
  }, [tool, context, router]);

  function copyShareLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 1500);
    });
  }

  function loadScenario(i: number) {
    setActiveScenario(i);
    setTool(SCENARIOS[i].tool);
    setContext(SCENARIOS[i].context);
    setArgsText(SCENARIOS[i].args);
    setArgsError("");
    setResponse(null);
    setError("");
  }

  function parseArgs(): Record<string, unknown> | undefined {
    const trimmed = argsText.trim();
    if (!trimmed || trimmed === "{}") return undefined;
    try {
      return JSON.parse(trimmed);
    } catch {
      setArgsError("Invalid JSON in args");
      return undefined;
    }
  }

  async function handleSend() {
    setArgsError("");
    const parsedArgs = parseArgs();
    if (argsError) return;

    setLoading(true);
    setError("");

    const requestBody: Record<string, unknown> = { tool: tool.trim() };
    if (context.trim()) requestBody.context = context.trim();
    if (parsedArgs) requestBody.args = parsedArgs;

    try {
      const res = await fetch("/api/sandbox/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Request failed");
        return;
      }

      setResponse(data as AuthResponse);
      setActiveTab("response");
      setHistory((prev) => [
        { tool: data.tool, decision: data.decision, requestId: data.requestId },
        ...prev,
      ].slice(0, 8));
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  function buildRequestBody() {
    const body: Record<string, unknown> = { tool: tool.trim() };
    if (context.trim()) body.context = context.trim();
    try {
      const parsed = JSON.parse(argsText);
      if (parsed && Object.keys(parsed).length > 0) body.args = parsed;
    } catch { /* ignore */ }
    return JSON.stringify(body, null, 2);
  }

  const curlBody = (() => {
    const b: Record<string, unknown> = { tool: tool.trim() || "your_tool" };
    if (context.trim()) b.context = context.trim();
    try {
      const parsed = JSON.parse(argsText);
      if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) b.args = parsed;
    } catch { /* ignore invalid json */ }
    return JSON.stringify(b);
  })();

  const curlCommand = `curl -X POST https://lelu-ai.com/api/v1/authorize \\
  -H "Authorization: Bearer ${SANDBOX_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '${curlBody}'`;

  function copyText(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B0B0C]">
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Header */}
        <div className="mb-8">
          <p className="text-[12px] text-[#A3A3A3] mb-3">Sandbox</p>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F4F4F5] dark:bg-[#27272A] text-[11px] font-semibold text-[#737373] uppercase tracking-widest mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live — no account required
          </div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-[24px] sm:text-[32px] font-bold tracking-[-0.03em] text-[#0A0A0A] dark:text-white mb-2">
                Authorization Playground
              </h1>
              <p className="text-[14px] text-[#737373] max-w-xl">
                Send real authorization requests to the Lelu API using the sandbox key below.
                Copy the curl command and run it in your terminal — it actually works.
              </p>
            </div>
            <button
              onClick={copyShareLink}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg border border-[#E7E5E4] dark:border-[#27272A] text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white hover:border-[#0A0A0A] dark:hover:border-white transition-colors"
              title="Copy shareable link"
            >
              {copiedShare ? (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>Copied!</>
              ) : (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" /></svg>Share</>
              )}
            </button>
          </div>
        </div>

        {/* Sandbox API key banner */}
        <div className="mb-8 bg-[#0A0A0A] dark:bg-[#111113] rounded-xl px-4 sm:px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-[#737373] uppercase tracking-widest font-semibold mb-0.5">Sandbox API Key</p>
              <code className="text-[11px] sm:text-[13px] font-mono text-white break-all">{SANDBOX_KEY}</code>
            </div>
          </div>
          <button
            onClick={() => copyText(SANDBOX_KEY, setCopiedKey)}
            className="flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[12px] font-medium transition-colors shrink-0"
          >
            {copiedKey ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
                Copied
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                Copy key
              </>
            )}
          </button>
        </div>

        {/* Scenario chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          {SCENARIOS.map((s, i) => {
            const cfg = DECISION_CONFIG[s.expected];
            return (
              <button
                key={i}
                onClick={() => loadScenario(i)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all ${
                  activeScenario === i
                    ? "bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] border-transparent"
                    : "bg-white dark:bg-[#111113] border-[#E7E5E4] dark:border-[#222224] text-[#0A0A0A] dark:text-white hover:border-[#0A0A0A]/30 dark:hover:border-white/20"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Main playground */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* LEFT: Request builder */}
          <div className="space-y-4">
            {/* Request form */}
            <div className="bg-white dark:bg-[#111113] border border-[#E7E5E4] dark:border-[#222224] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              {/* Method + endpoint */}
              <div className="flex items-center gap-0 border-b border-[#E7E5E4] dark:border-[#222224] px-4 py-3">
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded mr-3 shrink-0">POST</span>
                <span className="text-[12px] font-mono text-[#737373] truncate">/api/v1/authorize</span>
              </div>

              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-[#737373] uppercase tracking-widest">tool <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={tool}
                    onChange={(e) => { setTool(e.target.value); setActiveScenario(-1); }}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="e.g. send_email"
                    className="w-full h-10 px-3 rounded-lg border border-[#E7E5E4] dark:border-[#2A2A2C] bg-[#FAFAFA] dark:bg-[#18181B] text-[#0A0A0A] dark:text-white font-mono text-[13px] placeholder:text-[#A3A3A3] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/10 dark:focus:ring-white/10 focus:border-[#0A0A0A] dark:focus:border-white/20 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-[#737373] uppercase tracking-widest">context</label>
                  <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="What is the agent trying to do?"
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] dark:border-[#2A2A2C] bg-[#FAFAFA] dark:bg-[#18181B] text-[#0A0A0A] dark:text-white text-[13px] placeholder:text-[#A3A3A3] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/10 dark:focus:ring-white/10 focus:border-[#0A0A0A] dark:focus:border-white/20 transition-all resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-[#737373] uppercase tracking-widest">args <span className="font-normal normal-case text-[#A3A3A3]">(JSON)</span></label>
                  <textarea
                    value={argsText}
                    onChange={(e) => { setArgsText(e.target.value); setArgsError(""); }}
                    rows={4}
                    spellCheck={false}
                    className={`w-full px-3 py-2 rounded-lg border font-mono text-[12px] text-[#0A0A0A] dark:text-white bg-[#FAFAFA] dark:bg-[#18181B] placeholder:text-[#A3A3A3] focus:outline-none focus:ring-2 transition-all resize-none ${
                      argsError
                        ? "border-red-300 dark:border-red-800 focus:ring-red-500/10"
                        : "border-[#E7E5E4] dark:border-[#2A2A2C] focus:ring-[#0A0A0A]/10 dark:focus:ring-white/10 focus:border-[#0A0A0A] dark:focus:border-white/20"
                    }`}
                  />
                  {argsError && <p className="text-[11px] text-red-500">{argsError}</p>}
                </div>

                {error && (
                  <div className="px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40 text-[12px] text-red-600 dark:text-red-400">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleSend}
                  disabled={loading || !tool.trim()}
                  className="w-full h-10 rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] text-[13px] font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Sending…
                    </>
                  ) : (
                    <>
                      Send Request
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Request body preview */}
            <div className="bg-[#0F0F10] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#737373]">Request body</span>
              </div>
              <pre className="px-4 py-3 text-[11px] font-mono text-[#A3A3A3] leading-relaxed overflow-x-auto">
                {buildRequestBody()}
              </pre>
            </div>

            {/* Curl command */}
            <div className="bg-[#0F0F10] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#737373]">curl — paste this in your terminal</span>
                <button
                  onClick={() => copyText(curlCommand, setCopiedCurl)}
                  className="flex items-center gap-1.5 text-[10px] font-medium text-[#737373] hover:text-white transition-colors"
                >
                  {copiedCurl ? (
                    <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>Copied</>
                  ) : (
                    <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>Copy</>
                  )}
                </button>
              </div>
              <pre className="px-4 py-3 text-[11px] font-mono text-[#A3A3A3] leading-relaxed whitespace-pre-wrap break-all overflow-x-auto">
                <span className="text-[#737373]">$ </span>{curlCommand}
              </pre>
            </div>
          </div>

          {/* RIGHT: Response */}
          <div className="space-y-4">
            {response ? (
              <>
                {/* Decision */}
                <div className={`border rounded-2xl p-6 ${DECISION_CONFIG[response.decision].bg}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className={`text-[11px] font-bold uppercase tracking-widest mb-1 ${DECISION_CONFIG[response.decision].color}`}>Decision</p>
                      <p className={`text-[36px] font-bold tracking-[-0.02em] leading-none ${DECISION_CONFIG[response.decision].color}`}>
                        {DECISION_CONFIG[response.decision].label}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-[#A3A3A3] uppercase tracking-widest mb-1">Latency</p>
                      <p className="text-[22px] font-bold text-[#0A0A0A] dark:text-white">{response.latencyMs}ms</p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-black/5 dark:border-white/10">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#A3A3A3] mb-1">Reason</p>
                      <p className="text-[13px] text-[#0A0A0A] dark:text-white leading-relaxed">{response.reason}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#A3A3A3] mb-1">Rule</p>
                        <code className="text-[11px] font-mono text-[#0A0A0A] dark:text-white">{response.rule}</code>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#A3A3A3] mb-1">Mode</p>
                        <span className="text-[11px] font-mono text-[#0A0A0A] dark:text-white">{response.mode}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#A3A3A3] mb-1">Request ID</p>
                      <code className="text-[11px] font-mono text-[#0A0A0A] dark:text-white">{response.requestId}</code>
                    </div>
                    {response.decision === "compute" && response.safeTool && (
                      <div className="rounded-xl border border-violet-200 dark:border-violet-800/40 bg-violet-50 dark:bg-violet-900/10 p-3 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">Safe Alternative (Compute)</p>
                        <div>
                          <p className="text-[10px] text-[#A3A3A3] mb-0.5">Tool</p>
                          <code className="text-[11px] font-mono text-[#0A0A0A] dark:text-white">{response.safeTool}</code>
                        </div>
                        {response.safeArgs && (
                          <div>
                            <p className="text-[10px] text-[#A3A3A3] mb-0.5">Args</p>
                            <code className="text-[11px] font-mono text-[#0A0A0A] dark:text-white">{JSON.stringify(response.safeArgs)}</code>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Raw JSON response */}
                <div className="bg-[#0F0F10] rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#737373]">Response JSON</span>
                    <span className="text-[10px] font-mono text-emerald-500">200 OK</span>
                  </div>
                  <pre className="px-4 py-3 text-[11px] font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(response, null, 2)
                      .split("\n")
                      .map((line, i) => {
                        const keyMatch = line.match(/^(\s*)"([^"]+)":/);
                        if (keyMatch) {
                          return (
                            <span key={i}>
                              <span className="text-[#737373]">{keyMatch[1]}</span>
                              <span className="text-[#7dd3fc]">"{keyMatch[2]}"</span>
                              <span className="text-[#737373]">:</span>
                              <span className="text-[#A3A3A3]">{line.slice(keyMatch[0].length)}</span>
                              {"\n"}
                            </span>
                          );
                        }
                        return <span key={i} className="text-[#A3A3A3]">{line}{"\n"}</span>;
                      })}
                  </pre>
                </div>
              </>
            ) : (
              <div className="bg-white dark:bg-[#111113] border border-[#E7E5E4] dark:border-[#222224] rounded-2xl p-10 flex flex-col items-center justify-center text-center min-h-[240px]">
                <div className="w-12 h-12 rounded-full bg-[#F4F4F5] dark:bg-[#27272A] flex items-center justify-center mb-4">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#A3A3A3]">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <p className="text-[13px] text-[#737373] mb-1">Response will appear here</p>
                <p className="text-[12px] text-[#A3A3A3]">Pick a scenario or enter your own tool and hit Send</p>
              </div>
            )}

            {/* History */}
            {history.length > 0 && (
              <div className="bg-white dark:bg-[#111113] border border-[#E7E5E4] dark:border-[#222224] rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[#E7E5E4] dark:border-[#222224]">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#A3A3A3]">Request history</span>
                </div>
                <div className="divide-y divide-[#F4F4F5] dark:divide-[#1C1C1E]">
                  {history.map((h, i) => {
                    const cfg = DECISION_CONFIG[h.decision];
                    return (
                      <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3">
                        <span className="text-[12px] font-mono text-[#0A0A0A] dark:text-white truncate">{h.tool}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-10 bg-[#0A0A0A] dark:bg-[#111113] rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-[18px] font-bold text-white mb-1">Ready to protect your agents?</h3>
            <p className="text-[13px] text-[#737373]">Get a real API key and configure custom policies for your stack.</p>
          </div>
          <Link
            href="/register"
            className="shrink-0 px-6 py-3 bg-white text-[#0A0A0A] rounded-xl font-bold text-[14px] hover:bg-zinc-100 transition-colors whitespace-nowrap"
          >
            Get started free
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function SandboxPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B0B0C]" />}>
      <SandboxContent />
    </Suspense>
  );
}
