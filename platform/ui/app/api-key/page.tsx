"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function BetaPage() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<{
    requests: number;
    dailyLimit: number;
    minuteLimit: number;
    requestsThisMinute: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem("lelu_beta_key");
    if (savedKey) {
      setApiKey(savedKey);
      loadUsageStats(savedKey);
    }
  }, []);

  const generateKey = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/beta/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Failed to generate key");
        return;
      }
      const data = await response.json();
      setApiKey(data.apiKey);
      localStorage.setItem("lelu_beta_key", data.apiKey);
      await loadUsageStats(data.apiKey);
    } catch {
      alert("Failed to generate key. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadUsageStats = async (key: string) => {
    try {
      const response = await fetch(`/api/beta/usage?key=${encodeURIComponent(key)}`);
      if (response.ok) setUsage(await response.json());
    } catch {}
  };

  const copyToClipboard = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const deleteKey = () => {
    if (!confirm("Delete your beta key? This cannot be undone.")) return;
    localStorage.removeItem("lelu_beta_key");
    setApiKey(null);
    setUsage(null);
  };

  return (
    <main className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B0B0C] pt-24 md:pt-32 pb-20 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Page title */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E7E5E4] dark:border-[#222224] bg-white dark:bg-[#141416] px-4 py-1.5 text-[13px] text-zinc-500 dark:text-zinc-400 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0A0A0A] dark:bg-white" />
            Beta Access
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0A0A0A] dark:text-white lowercase mb-3">
            get your free api key.
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-base leading-relaxed">
            No signup required. Generate an anonymous key and start building AI agent authorization in seconds.
          </p>
        </div>

        {!apiKey ? (
          /* ── Generate Key ── */
          <div className="space-y-4">
            <div className="border border-[#E7E5E4] dark:border-[#222224] rounded-xl p-8 bg-white dark:bg-[#141416]">
              <h2 className="text-lg font-semibold text-[#0A0A0A] dark:text-white mb-1">
                Get Your Free Beta Key
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                Zero registration. Zero friction. Just click and code.
              </p>

              <button
                onClick={generateKey}
                disabled={loading}
                className="w-full py-3 bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Generating..." : "Generate Anonymous Key"}
              </button>

              <div className="mt-6 grid grid-cols-3 gap-4 pt-6 border-t border-[#E7E5E4] dark:border-[#222224]">
                {[
                  { label: "Instant Access", sub: "No email required" },
                  { label: "Privacy First", sub: "Completely anonymous" },
                  { label: "500 req/day", sub: "Perfect for testing" },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <div className="text-sm font-medium text-[#0A0A0A] dark:text-white">{item.label}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{item.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cold start notice */}
            <div className="border border-[#E7E5E4] dark:border-[#222224] rounded-xl p-4 bg-white dark:bg-[#141416] flex gap-3">
              <span className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                <span className="font-medium text-[#0A0A0A] dark:text-white">First request may take 30–60s.</span>{" "}
                The engine warms up on cold start. Subsequent requests are &lt;100ms.
              </span>
            </div>

            {/* Discord */}
            <div className="border border-[#E7E5E4] dark:border-[#222224] rounded-xl p-4 bg-white dark:bg-[#141416] flex gap-3 items-start">
              <svg className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              <div className="flex-1 text-sm">
                <span className="font-medium text-[#0A0A0A] dark:text-white">Need Help? </span>
                <a href="https://discord.gg/lelu" target="_blank" rel="noopener noreferrer" className="text-zinc-500 dark:text-zinc-400 hover:text-[#0A0A0A] dark:hover:text-white transition-colors">
                  Join our Discord →
                </a>
              </div>
            </div>
          </div>
        ) : (
          /* ── Key Display ── */
          <div className="space-y-4">
            <div className="border border-[#E7E5E4] dark:border-[#222224] rounded-xl p-6 bg-white dark:bg-[#141416]">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h2 className="text-lg font-semibold text-[#0A0A0A] dark:text-white mb-0.5">Your Beta Key</h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Save this — you won't see it again.</p>
                </div>
                <button onClick={deleteKey} className="text-xs text-red-500 hover:text-red-600 transition-colors">
                  Delete Key
                </button>
              </div>

              {/* Warning */}
              <div className="border border-[#E7E5E4] dark:border-[#222224] rounded-lg p-3 mb-4 flex gap-3 items-start text-sm">
                <span className="text-zinc-400">⚠</span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium text-[#0A0A0A] dark:text-white">Copy this to your .env now.</span>{" "}
                  Stored only in your browser — closing this page won't delete it, but clearing localStorage will.
                </span>
              </div>

              {/* Key block */}
              <div className="bg-[#0A0A0A] dark:bg-[#141416] border border-[#222224] rounded-lg p-4 mb-4 flex items-center gap-3">
                <code className="text-green-400 font-mono text-xs break-all flex-1">{apiKey}</code>
                <button
                  onClick={copyToClipboard}
                  className="px-3 py-1.5 bg-white dark:bg-[#222224] text-[#0A0A0A] dark:text-white rounded text-xs font-medium hover:opacity-80 transition-opacity whitespace-nowrap shrink-0"
                >
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>

              {usage && (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Requests Today", value: usage.requests, limit: usage.dailyLimit },
                    { label: "This Minute", value: usage.requestsThisMinute, limit: usage.minuteLimit },
                  ].map((stat) => (
                    <div key={stat.label} className="border border-[#E7E5E4] dark:border-[#222224] rounded-lg p-3">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{stat.label}</div>
                      <div className="text-lg font-semibold text-[#0A0A0A] dark:text-white">
                        {stat.value} <span className="text-sm font-normal text-zinc-400">/ {stat.limit}</span>
                      </div>
                      <div className="mt-2 w-full bg-zinc-100 dark:bg-[#222224] rounded-full h-1.5">
                        <div
                          className="bg-[#0A0A0A] dark:bg-white h-1.5 rounded-full transition-all"
                          style={{ width: `${Math.min((stat.value / stat.limit) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Start */}
            <div className="border border-[#E7E5E4] dark:border-[#222224] rounded-xl p-6 bg-white dark:bg-[#141416]">
              <h3 className="text-base font-semibold text-[#0A0A0A] dark:text-white mb-4">Quick Start</h3>
              <div className="space-y-4">
                {[
                  { step: "1. Install the SDK", code: "npm install lelu-agent-auth" },
                  { step: "2. Add to your .env", code: `LELU_API_KEY=${apiKey}` },
                ].map((item) => (
                  <div key={item.step}>
                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">{item.step}</div>
                    <div className="bg-[#0A0A0A] dark:bg-[#141416] border border-[#222224] rounded-lg p-3">
                      <code className="text-green-400 font-mono text-xs">{item.code}</code>
                    </div>
                  </div>
                ))}
                <div>
                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">3. Use in your code</div>
                  <div className="bg-[#0A0A0A] dark:bg-[#141416] border border-[#222224] rounded-lg p-3 overflow-x-auto">
                    <pre className="text-green-400 font-mono text-xs">{`import { createClient } from "lelu-agent-auth";

const lelu = createClient({ apiKey: process.env.LELU_API_KEY });

const decision = await lelu.agentAuthorize({
  actor: "invoice_bot",
  action: "approve_refunds",
  resource: { amount: "500" },
  confidence_signal: { provider: "openai", token_logprobs: [-0.05] }
});

if (!decision.allowed) console.log("Denied:", decision.reason);`}</pre>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <Link href="/docs/quickstart" className="flex-1 py-2.5 bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] rounded-lg text-center text-sm font-medium hover:opacity-90 transition-opacity">
                  Full Documentation
                </Link>
                <Link href="/docs" className="flex-1 py-2.5 border border-[#E7E5E4] dark:border-[#222224] text-zinc-700 dark:text-zinc-300 rounded-lg text-center text-sm font-medium hover:bg-zinc-50 dark:hover:bg-[#141416] transition-colors">
                  View Examples
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Beta limits + upgrade */}
        <div className="mt-6 grid md:grid-cols-2 gap-4">
          <div className="border border-[#E7E5E4] dark:border-[#222224] rounded-xl p-5 bg-white dark:bg-[#141416]">
            <h3 className="text-sm font-semibold text-[#0A0A0A] dark:text-white mb-3">Beta Limits</h3>
            <ul className="space-y-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              {["500 authorization requests per day", "10 requests per minute", "50 token mints per day", "30-day key expiration (with activity)"].map((l) => (
                <li key={l} className="flex items-start gap-2">
                  <span className="text-[#0A0A0A] dark:text-white mt-0.5">✓</span>
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-[#E7E5E4] dark:border-[#222224] rounded-xl p-5 bg-white dark:bg-[#141416]">
            <h3 className="text-sm font-semibold text-[#0A0A0A] dark:text-white mb-1">Need More?</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">Create an account for higher limits and advanced features.</p>
            <ul className="space-y-1.5 text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              {["10,000 requests per month", "Persistent data storage", "Team collaboration", "Priority support"].map((l) => (
                <li key={l} className="flex items-start gap-2">
                  <span className="text-zinc-400">→</span>
                  <span>{l}</span>
                </li>
              ))}
            </ul>
            <Link href="/dashboard" className="block w-full py-2.5 bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] rounded-lg text-center text-sm font-medium hover:opacity-90 transition-opacity">
              Create Account
            </Link>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-6 border border-[#E7E5E4] dark:border-[#222224] rounded-xl p-6 bg-white dark:bg-[#141416]">
          <h3 className="text-base font-semibold text-[#0A0A0A] dark:text-white mb-5">FAQ</h3>
          <div className="space-y-4 text-sm">
            {[
              { q: "Do I need to create an account?", a: "No. During beta, anonymous keys require no registration — perfect for testing and evaluation." },
              { q: "How long does my key last?", a: "30 days from last use. As long as you keep using it, it won't expire." },
              { q: "What happens when I hit the limit?", a: "You'll receive a 429 error. Limits reset daily at midnight UTC." },
              { q: "Is my data safe?", a: "We don't collect personal info with anonymous keys. Your key is stored only in your browser's localStorage." },
            ].map((item) => (
              <div key={item.q} className="border-t border-[#E7E5E4] dark:border-[#222224] pt-4 first:border-0 first:pt-0">
                <div className="font-medium text-[#0A0A0A] dark:text-white mb-1">{item.q}</div>
                <div className="text-zinc-500 dark:text-zinc-400">{item.a}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
