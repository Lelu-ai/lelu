"use client";

import { useState } from "react";
import Link from "next/link";
import { LeluMark } from "@/components/ui/LeluMark";

/* ── Tabbed code block ─────────────────────────────────────────────── */
const CODE: Record<string, string> = {
  CLI: `npm install lelu-agent-auth
npx lelu init`,
  TypeScript: `import { createClient } from "lelu-agent-auth";

const lelu = createClient({
  apiKey: process.env.LELU_API_KEY,
});

const decision = await lelu.agentAuthorize({
  actor: "billing-agent",
  action: "refund:process",
  context: { confidence: 0.85 },
});

if (decision.allowed) {
  // proceed
} else if (decision.requiresHumanReview) {
  // queued for human approval
}`,
  curl: `curl -X POST https://lelu-engine-666101080696.us-central1.run.app/v1/agent/authorize \\
  -H "Authorization: Bearer $LELU_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"actor":"billing-agent","action":"refund:process","confidence":0.85}'`,
};

const TRUSTED = [
  "Vercel AI SDK", "LangChain", "OpenAI", "Anthropic", "Claude", "Mistral",
  "LlamaIndex", "CrewAI", "AutoGPT", "Vercel", "Fly.io", "Railway",
];

const FEATURES = [
  {
    n: "01",
    title: "Confidence-aware gating.",
    body: "Every agent action carries a confidence score. Low confidence routes to human review automatically — no code change needed.",
  },
  {
    n: "02",
    title: "Human-in-the-loop review.",
    body: "Agents pause, queue their action, and resume once a human approves or denies. Full audit trail included.",
  },
  {
    n: "03",
    title: "Policy-driven authorization.",
    body: "Write Rego policies to express complex rules. Allow, deny, or require review — per actor, action, or resource.",
  },
];

const RIGHT_TABS = ["README", "DOCS", "SDK", "ENTERPRISE", "CHANGELOG"];

/* ── Dot-mesh decoration for left panel ───────────────────────────── */
function DotMesh() {
  return (
    <div className="relative w-36 h-36 mx-auto mb-6 select-none pointer-events-none">
      {/* Faint grid dots */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "12px 12px",
          maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
        }}
      />
      {/* LeluMark centered, large */}
      <div className="absolute inset-0 flex items-center justify-center">
        <LeluMark size={72} className="opacity-60" />
      </div>
      {/* Outer glow ring */}
      <div className="absolute inset-8 rounded-full border border-white/10" />
      <div className="absolute inset-4 rounded-full border border-white/5" />
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────────────── */
export default function HomePage() {
  const [codeTab, setCodeTab] = useState<keyof typeof CODE>("CLI");
  const [rightTab, setRightTab] = useState("README");
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(CODE[codeTab]).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden">

      {/* ── LEFT PANEL ───────────────────────────────────────────────── */}
      <div className="lg:w-[420px] xl:w-[480px] shrink-0 bg-[#0A0A0A] flex flex-col px-8 py-10 lg:py-12 overflow-hidden">

        {/* Wordmark */}
        <div className="flex items-center gap-2.5 mb-auto lg:mb-0">
          <LeluMark size={20} className="brightness-0 invert" />
          <span className="text-white font-bold text-[15px] tracking-[0.08em] uppercase">
            Lelu.
          </span>
        </div>

        {/* Dot-mesh visual */}
        <div className="my-6 lg:my-auto">
          <DotMesh />

          {/* Announcement badge */}
          <div className="flex justify-center mb-8">
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 text-[12px] text-white/60 hover:text-white/90 transition-colors"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              Introducing
              <span className="text-white/30 mx-0.5">|</span>
              Authorization Protocol
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-0.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Headline */}
          <h1 className="text-white text-[1.45rem] sm:text-[1.65rem] xl:text-[1.8rem] font-bold leading-[1.15] tracking-tight mb-8 text-center lg:text-left">
            The authorization layer for autonomous AI agents
          </h1>

          {/* CTAs */}
          <div className="flex items-center gap-3 justify-center lg:justify-start flex-wrap">
            <Link
              href="/register"
              className="px-5 py-2.5 bg-white text-[#0A0A0A] text-[14px] font-semibold rounded-md hover:bg-zinc-100 transition-colors"
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className="px-5 py-2.5 border border-white/20 text-white text-[14px] font-medium rounded-md hover:bg-white/5 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Bottom footer links */}
        <div className="mt-10 lg:mt-auto pt-8 border-t border-white/10 flex items-center gap-4 text-[12px] text-white/40 flex-wrap">
          <a href="https://github.com/lelu-auth/lelu" target="_blank" rel="noreferrer" className="hover:text-white/70 transition-colors">Community</a>
          <span className="text-white/20">/</span>
          <Link href="/docs" className="hover:text-white/70 transition-colors">Changelog</Link>
          <span className="text-white/20">/</span>
          <Link href="/docs" className="hover:text-white/70 transition-colors">Legal</Link>
          <span className="text-white/20">/</span>
          <Link href="/about" className="hover:text-white/70 transition-colors">Careers</Link>
          {/* Social */}
          <div className="ml-auto flex items-center gap-3 text-white/30">
            <a href="https://x.com/lelu_auth" target="_blank" rel="noreferrer" className="hover:text-white/70 transition-colors" aria-label="X">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="https://github.com/lelu-auth/lelu" target="_blank" rel="noreferrer" className="hover:text-white/70 transition-colors" aria-label="GitHub">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>
            </a>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ──────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col border-t lg:border-t-0 lg:border-l border-[#E7E5E4] dark:border-[#27272A] bg-white dark:bg-[#0B0B0C] overflow-y-auto">

        {/* Right panel tab bar */}
        <div className="sticky top-0 z-10 flex items-center border-b border-[#E7E5E4] dark:border-[#27272A] bg-white/90 dark:bg-[#0B0B0C]/90 backdrop-blur-sm px-6 shrink-0">
          <div className="flex items-center gap-0 -mb-px flex-1 overflow-x-auto no-scrollbar">
            {RIGHT_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                className={`px-4 py-3.5 text-[12px] font-bold tracking-[0.06em] uppercase whitespace-nowrap border-b-[1.5px] transition-colors ${
                  rightTab === tab
                    ? "border-[#0A0A0A] dark:border-white text-[#0A0A0A] dark:text-white"
                    : "border-transparent text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white"
                }`}
              >
                {tab}
                {(tab === "SDK" || tab === "ENTERPRISE") && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline ml-1 mb-0.5"><path d="M6 9l6 6 6-6" /></svg>
                )}
              </button>
            ))}
          </div>
          <Link
            href="/login"
            className="ml-4 shrink-0 px-3 py-1.5 text-[11px] font-bold tracking-[0.06em] uppercase border border-[#0A0A0A] dark:border-white text-[#0A0A0A] dark:text-white rounded hover:bg-[#0A0A0A] hover:text-white dark:hover:bg-white dark:hover:text-[#0A0A0A] transition-colors flex items-center gap-1"
          >
            SIGN IN
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17L17 7M17 7H7M17 7v10" /></svg>
          </Link>
        </div>

        {/* README content */}
        <div className="flex-1 px-6 sm:px-10 py-10 max-w-[800px]">

          {/* Section heading */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#737373] border border-[#E7E5E4] dark:border-[#27272A] px-2 py-0.5 rounded">
              README
            </span>
          </div>

          {/* Lead paragraph */}
          <p className="text-[16px] text-[#0A0A0A] dark:text-[#E4E4E7] leading-relaxed mb-8 max-w-[600px]">
            Authorization that lives <strong>inside your agent</strong>. Confidence-aware, policy-driven, and built to scale — from weekend AI projects to production agent swarms.
          </p>

          {/* Code block with tabs */}
          <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#27272A] mb-10">
            <div className="flex items-center justify-between px-3 py-2 bg-[#F5F5F4] dark:bg-[#141416] border-b border-[#E7E5E4] dark:border-[#27272A]">
              <div className="flex items-center gap-1">
                {(Object.keys(CODE) as (keyof typeof CODE)[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setCodeTab(tab)}
                    className={`px-2.5 py-1 text-[12px] rounded transition-colors ${
                      codeTab === tab
                        ? "bg-white dark:bg-[#0B0B0C] text-[#0A0A0A] dark:text-white border border-[#E7E5E4] dark:border-[#27272A] font-medium"
                        : "text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <button
                onClick={copy}
                className="flex items-center gap-1.5 text-[11px] text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white transition-colors"
              >
                {copied ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500"><polyline points="20 6 9 17 4 12" /></svg>
                    <span className="text-emerald-500">Copied</span>
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                    Copy
                  </>
                )}
              </button>
            </div>
            <pre className="p-5 bg-white dark:bg-[#0B0B0C] text-[13px] font-mono text-[#0A0A0A] dark:text-[#E4E4E7] leading-relaxed overflow-x-auto">
              {CODE[codeTab]}
            </pre>
          </div>

          {/* Trusted by */}
          <div className="mb-10">
            <p className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#A3A3A3] mb-4">
              Trusted by teams building with
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {TRUSTED.map((t) => (
                <span key={t} className="text-[13px] text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white transition-colors cursor-default">
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#E7E5E4] dark:border-[#27272A] mb-10" />

          {/* Features */}
          <div className="mb-6">
            <p className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#A3A3A3] mb-6">Features</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {FEATURES.map((f) => (
                <div key={f.n} className="rounded-lg border border-[#E7E5E4] dark:border-[#27272A] p-5 hover:border-[#0A0A0A] dark:hover:border-white transition-colors group">
                  <p className="text-[11px] font-bold text-[#A3A3A3] mb-3">{f.n}</p>
                  <p className="text-[14px] font-semibold text-[#0A0A0A] dark:text-white mb-2 leading-snug">{f.title}</p>
                  <p className="text-[13px] text-[#737373] leading-relaxed">{f.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#E7E5E4] dark:border-[#27272A] mb-8" />

          {/* Quick links */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px]">
            {[
              { label: "Quickstart", href: "/docs/quickstart" },
              { label: "API Reference", href: "/docs/concepts/api" },
              { label: "SDK Docs", href: "/docs/installation" },
              { label: "GitHub", href: "https://github.com/lelu-auth/lelu" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center gap-1.5 font-medium text-[#0A0A0A] dark:text-white hover:opacity-60 transition-opacity"
              >
                {l.label}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17L17 7M17 7H7M17 7v10" /></svg>
              </Link>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
