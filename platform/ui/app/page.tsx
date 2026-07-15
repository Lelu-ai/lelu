"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { LeluMark } from "@/components/ui/LeluMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import IntegrationMarquee from "@/components/IntegrationMarquee";
import WorkflowDiagram from "@/components/WorkflowDiagram";

/* ── Design tokens (alterauth-style dark) ──────────────────────────────
   base    #0A0B10   surface #0D0E13   elevated rgba(255,255,255,0.04)
   border  rgba(255,255,255,0.06)      text #EDEEF0 / #8B8D98 / #5A5C66
   accent  Lelu gradient #8B5CF6 → #3B82F6 → #06B6D4                     */

const CODE: Record<string, string> = {
  CLI: `npx -y lelu-mcp start
# → local engine ready — policy, key, and audit
#   trail live in ~/.lelu. No account needed.`,
  TypeScript: `// npm install lelu-agent-auth
import { lelu } from "lelu-agent-auth";

// Zero-config: finds the engine that
// \`npx lelu-mcp start\` is already running.
const auth = lelu();

const decision = await auth.authorize({
  tool: "refund:process",
  actor: "billing-agent",
  context: { confidence: 0.85 },
});

if (decision.allowed) {
  // proceed
} else if (decision.decision === "human_review") {
  // queued for human approval
}`,
  Python: `# pip install lelu-agent-auth-sdk
from lelu import lelu

# Zero-config: finds the engine that
# \`npx lelu-mcp start\` is already running.
auth = lelu(actor="billing-agent")

result = await auth.authorize(
    tool="refund:process",
    context={"confidence": 0.85},
)

if result.decision == "allow":
    ...  # proceed
elif result.decision == "human_review":
    ...  # queued for human approval`,
  curl: `curl -X POST localhost:8082/v1/agent/authorize \\
  -H "Authorization: Bearer $LELU_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"actor":"billing-agent","action":"refund:process","confidence":0.85}'`,
};

/* ── Section kicker (mono uppercase label) ─────────────────────────── */
function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.08em] text-[#0A0A0A] dark:text-white font-mono">
        {children}
      </span>
    </div>
  );
}

function SectionHead({
  kicker,
  title,
  sub,
}: {
  kicker: string;
  title: string;
  sub: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
      className="text-center max-w-2xl mx-auto"
    >
      <Kicker>{kicker}</Kicker>
      <h2 className="text-[22px] font-semibold tracking-tight sm:text-[26px] lg:text-[30px] text-[#0A0A0A] dark:text-white leading-[1.2]">
        {title}
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed text-[#737373] dark:text-[#8B8D98] max-w-xl mx-auto">{sub}</p>
    </motion.div>
  );
}

/* ── Request-flow steps (How it works) ─────────────────────────────── */
const STEPS = [
  {
    n: "01",
    title: "Agent calls a tool",
    body: "LangChain, CrewAI, MCP, or plain HTTP — the agent asks Lelu before acting.",
    mono: "POST /v1/agent/authorize",
  },
  {
    n: "02",
    title: "Identity & policy",
    body: "The actor is resolved and the action is checked against your YAML or Rego policy.",
    mono: "actor: support-bot",
  },
  {
    n: "03",
    title: "Security filters",
    body: "Prompt-injection screening, verified confidence gating, and behavioral anomaly scoring.",
    mono: "confidence: 0.92 ✓",
  },
  {
    n: "04",
    title: "Decision returned",
    body: "allow, deny, human_review, or compute — one of four explicit outcomes, never a guess.",
    mono: `"allowed": false`,
  },
  {
    n: "05",
    title: "Audit log written",
    body: "Every decision is recorded with full context: who, what, why, and the trace ID.",
    mono: "trace_id: tr_7f3a9c",
  },
];

const DECISIONS = [
  { label: "allow", color: "#30A46C", desc: "the action runs" },
  { label: "deny", color: "#E5484D", desc: "blocked, with a reason" },
  { label: "human_review", color: "#F5A623", desc: "pauses for approval" },
  { label: "compute", color: "#8B5CF6", desc: "rerouted to a sandbox" },
];

/* ── Main page ─────────────────────────────────────────────────────── */
export default function HomePage() {
  const [codeTab, setCodeTab] = useState<keyof typeof CODE>("CLI");
  const [copied, setCopied] = useState(false);
  const [npxCopied, setNpxCopied] = useState(false);
  const [npmCopied, setNpmCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(CODE[codeTab]).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function copyNpx() {
    navigator.clipboard.writeText("npx -y lelu-mcp start").then(() => {
      setNpxCopied(true);
      setTimeout(() => setNpxCopied(false), 1500);
    });
  }

  function copyNpm() {
    navigator.clipboard.writeText("npm install lelu-agent-auth").then(() => {
      setNpmCopied(true);
      setTimeout(() => setNpmCopied(false), 1500);
    });
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0B10] text-[#18181B] dark:text-[#EDEEF0] antialiased">

      {/* ── NAV ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-[#E7E5E4] dark:border-white/[0.06] bg-[#FAFAFA]/85 dark:bg-[#0A0B10]/80 backdrop-blur-md">
        <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <LeluMark size={18} />
            <span className="text-[#0A0A0A] dark:text-white font-bold text-[14px] tracking-[0.08em] uppercase">Lelu</span>
          </Link>
          <div className="hidden sm:flex items-center gap-6 text-[13px] text-[#737373] dark:text-[#8B8D98]">
            <Link href="/docs" className="hover:text-[#0A0A0A] dark:hover:text-white transition-colors">Docs</Link>
            <Link href="/pricing" className="hover:text-[#0A0A0A] dark:hover:text-white transition-colors">Pricing</Link>
            <Link href="/sandbox" className="hover:text-[#0A0A0A] dark:hover:text-white transition-colors">Sandbox</Link>
            <Link href="/about" className="hover:text-[#0A0A0A] dark:hover:text-white transition-colors">About</Link>
            <a href="https://github.com/lelu-ai/lelu" target="_blank" rel="noreferrer" className="hover:text-[#0A0A0A] dark:hover:text-white transition-colors">GitHub</a>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/docs/quickstart"
              className="rounded-md bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6] px-3.5 py-1.5 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      {/* ── HERO ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 pt-16 sm:pt-24 pb-12" aria-label="Hero">
        {/* backdrop glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(59,130,246,0.10)_0%,transparent_70%)]" />
        <div className="relative mx-auto max-w-6xl text-center">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-full border border-[#D6D3D1] dark:border-white/[0.1] bg-black/[0.03] dark:bg-white/[0.03] px-3 py-1.5 text-[12px] text-[#737373] dark:text-[#8B8D98] hover:text-[#0A0A0A] dark:hover:text-white transition-colors"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              Zero-config local engine — no account needed
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </Link>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mx-auto mt-6 max-w-3xl text-[36px] sm:text-[52px] font-semibold tracking-tight text-[#0A0A0A] dark:text-white leading-[1.08]"
          >
            The authorization engine for AI agents.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="mx-auto mt-5 max-w-xl text-[15px] sm:text-[16px] leading-relaxed text-[#737373] dark:text-[#8B8D98]"
          >
            Every action checked. Every decision logged. Humans in the loop when it
            matters — a permission system your agents can&apos;t talk their way around.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.24 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              href="/docs/quickstart"
              className="rounded-md bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6] px-5 py-2.5 text-[14px] font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Get started
            </Link>
            <Link
              href="/sandbox"
              className="rounded-md border border-[#D6D3D1] dark:border-white/[0.12] px-5 py-2.5 text-[14px] font-medium text-[#0A0A0A] dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors"
            >
              Try the sandbox
            </Link>
          </motion.div>

          {/* install one-liners: MCP + SDK */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-3"
          >
            <button
              onClick={copyNpx}
              className="group inline-flex items-center gap-3 rounded-lg border border-[#E7E5E4] dark:border-white/[0.08] bg-white dark:bg-[#0D0E13] px-4 py-2.5 font-mono text-[13px] text-[#3F3F46] dark:text-[#C9C9D2] hover:border-[#A8A29E] dark:hover:border-white/[0.16] transition-colors"
            >
              <span className="text-[#30A46C]">$</span> npx -y lelu-mcp start
              {npxCopied ? (
                <span className="text-[11px] text-emerald-400">copied</span>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#8E8E93] dark:text-[#5A5C66] group-hover:text-[#0A0A0A] dark:hover:text-white transition-colors"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              )}
            </button>
            <button
              onClick={copyNpm}
              className="group inline-flex items-center gap-3 rounded-lg border border-[#E7E5E4] dark:border-white/[0.08] bg-white dark:bg-[#0D0E13] px-4 py-2.5 font-mono text-[13px] text-[#3F3F46] dark:text-[#C9C9D2] hover:border-[#A8A29E] dark:hover:border-white/[0.16] transition-colors"
            >
              <span className="text-[#30A46C]">$</span> npm install lelu-agent-auth
              {npmCopied ? (
                <span className="text-[11px] text-emerald-400">copied</span>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#8E8E93] dark:text-[#5A5C66] group-hover:text-[#0A0A0A] dark:hover:text-white transition-colors"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              )}
            </button>
          </motion.div>

          {/* Hero visual: animated authorization flow */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.38 }}
            className="mx-auto mt-14 max-w-[820px]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/lelu-flow-light.svg"
              alt="Agents built with LangChain, CrewAI, Claude Code (MCP), or plain REST call Lelu and receive allow, deny, human_review, or compute decisions — every decision written to the audit log"
              width={760}
              height={330}
              className="w-full h-auto rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.06)] dark:hidden"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/lelu-flow.svg"
              alt=""
              aria-hidden="true"
              width={760}
              height={330}
              className="w-full h-auto rounded-2xl shadow-[0_0_80px_rgba(59,130,246,0.08)] hidden dark:block"
            />
          </motion.div>
        </div>
      </section>

      {/* ── TRUST STRIP ─────────────────────────────────────────────── */}
      <section className="relative border-y border-[#E7E5E4] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02] py-4" aria-label="Trust signals">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-6 px-4 sm:gap-10 text-[#8E8E93] dark:text-[#5A5C66]">
          {[
            "Prompt-injection filtering",
            "Verified confidence gating",
            "Human-in-the-loop approvals",
            "MIT licensed · self-hostable",
          ].map((t, i) => (
            <div key={t} className="flex items-center gap-2">
              {i > 0 && <span className="hidden sm:block h-3 w-px bg-black/[0.08] dark:bg-white/[0.08] -ml-5" aria-hidden />}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#30A46C]"><path d="M20 6L9 17l-5-5" /></svg>
              <span className="text-[12px] font-medium">{t}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── LIVE WORKFLOW ───────────────────────────────────────────── */}
      <section className="relative px-4 py-16 sm:py-24" aria-label="Live request flow">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            kicker="Inside a request"
            title="Legitimate requests pass. Attacks don't."
            sub="Watch a request travel from your agent through Lelu's policy, confidence, and injection checks — and see what happens when a prompt injection tries the same path."
          />
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="mt-12"
          >
            <WorkflowDiagram />
          </motion.div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────── */}
      <section className="relative px-4 py-16 sm:py-24" aria-label="How it works">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            kicker="How it works"
            title="Lelu checks, decides, and logs every agent action"
            sub="One HTTP call replaces weeks of guardrail infrastructure. Works with every major agent framework."
          />
          <div className="mt-12 grid gap-3 md:grid-cols-5">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="relative rounded-xl border border-[#E7E5E4] dark:border-white/[0.06] bg-white dark:bg-[#0D0E13]/60 p-5 hover:border-[#A8A29E] dark:hover:border-[#D6D3D1] dark:border-white/[0.12] transition-colors"
              >
                <p className="font-mono text-[11px] font-bold text-[#8E8E93] dark:text-[#5A5C66] mb-3">{s.n}</p>
                <p className="text-[14px] font-semibold text-[#0A0A0A] dark:text-white leading-snug mb-2">{s.title}</p>
                <p className="text-[12.5px] leading-relaxed text-[#737373] dark:text-[#8B8D98]">{s.body}</p>
                <p className="mt-4 font-mono text-[11px] text-[#60A5FA] truncate">{s.mono}</p>
              </motion.div>
            ))}
          </div>

          {/* Four decisions */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {DECISIONS.map((d) => (
              <div
                key={d.label}
                className="flex items-center gap-3 rounded-xl border border-[#E7E5E4] dark:border-white/[0.06] bg-white dark:bg-[#0D0E13]/60 px-4 py-3.5"
              >
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                <span className="font-mono text-[13px] font-medium" style={{ color: d.color }}>{d.label}</span>
                <span className="text-[12px] text-[#8E8E93] dark:text-[#5A5C66] ml-auto">{d.desc}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── SEE IT IN ACTION ────────────────────────────────────────── */}
      <section className="relative px-4 py-16 sm:py-24 border-t border-[#E7E5E4] dark:border-white/[0.06]" aria-label="See it in action">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            kicker="See it in action"
            title="Your agent asks. Lelu decides."
            sub="Run the real engine on your machine in one command — no account, no Docker, no config."
          />
          <div className="mt-12 grid gap-6 lg:grid-cols-2 items-start">
            {/* Animated terminal */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/lelu-terminal-light.svg"
                alt="Terminal demo: npx -y lelu-mcp start launches the zero-config local engine, then a curl to /v1/agent/authorize asking to delete_all_records is denied by policy"
                width={760}
                height={272}
                className="w-full h-auto rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.06)] dark:hidden"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/lelu-terminal.svg"
                alt=""
                aria-hidden="true"
                width={760}
                height={272}
                className="w-full h-auto rounded-2xl hidden dark:block"
              />
            </motion.div>

            {/* Code tabs */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="rounded-2xl overflow-hidden border border-[#E7E5E4] dark:border-white/[0.06] bg-white dark:bg-[#0D0E13]"
            >
              <div className="flex items-center justify-between px-3 py-2 bg-black/[0.03] dark:bg-white/[0.03] border-b border-[#E7E5E4] dark:border-white/[0.06]">
                <div className="flex items-center gap-1">
                  {(Object.keys(CODE) as (keyof typeof CODE)[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setCodeTab(tab)}
                      className={`px-2.5 py-1 text-[12px] rounded transition-colors ${
                        codeTab === tab
                          ? "bg-black/[0.06] text-[#0A0A0A] dark:bg-white/[0.08] dark:text-white font-medium"
                          : "text-[#737373] dark:text-[#8B8D98] hover:text-[#0A0A0A] dark:hover:text-white"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <button
                  onClick={copy}
                  className="flex items-center gap-1.5 text-[11px] text-[#737373] dark:text-[#8B8D98] hover:text-[#0A0A0A] dark:hover:text-white transition-colors"
                >
                  {copied ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400"><polyline points="20 6 9 17 4 12" /></svg>
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="p-5 text-[13px] font-mono text-[#3F3F46] dark:text-[#C9C9D2] leading-relaxed overflow-x-auto min-h-[220px]">
                {CODE[codeTab]}
              </pre>
            </motion.div>
          </div>
          <div className="mt-8 text-center">
            <Link href="/sandbox" className="text-[13px] text-[#60A5FA] hover:text-[#0A0A0A] dark:hover:text-white transition-colors">
              Or try it in the live sandbox — no signup →
            </Link>
          </div>
        </div>
      </section>

      {/* ── INTEGRATIONS ────────────────────────────────────────────── */}
      <section className="relative py-16 sm:py-24 overflow-hidden border-t border-[#E7E5E4] dark:border-white/[0.06]" aria-label="Integrations">
        <div className="px-4">
          <SectionHead
            kicker="Integrations"
            title="Works with your stack"
            sub="Agent frameworks, policy languages, identity standards, and observability tools."
          />
        </div>
        <div className="mt-10 [&_section]:border-t-0 [&_section]:py-0 [&_section>div:first-child]:hidden">
          <IntegrationMarquee />
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className="relative px-4 py-10 sm:py-14" aria-label="Call to action">
        <div className="mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-2xl border border-[#E7E5E4] dark:border-white/[0.06] bg-white dark:bg-[#0D0E13]/60 px-8 py-14 text-center sm:px-16">
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
                maskImage: "radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 100%)",
                WebkitMaskImage: "radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 100%)",
              }}
            />
            <h2 className="relative text-[22px] font-semibold tracking-tight sm:text-[26px] text-[#0A0A0A] dark:text-white">
              Ready to give your agents guardrails?
            </h2>
            <p className="relative mt-3 text-[15px] text-[#737373] dark:text-[#8B8D98] max-w-md mx-auto">
              The local engine is free, open source, and starts in one command.
            </p>
            <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/docs/quickstart"
                className="rounded-md bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6] px-5 py-2.5 text-[14px] font-semibold text-white hover:opacity-90 transition-opacity"
              >
                Get started
              </Link>
              <a
                href="https://github.com/lelu-ai/lelu"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-[#D6D3D1] dark:border-white/[0.12] px-5 py-2.5 text-[14px] font-medium text-[#0A0A0A] dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>
                Star on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────── */}
      <footer className="border-t border-[#E7E5E4] dark:border-white/[0.06] px-4 py-12" aria-label="Footer">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <LeluMark size={18} />
                <span className="text-[#0A0A0A] dark:text-white font-bold text-[14px] tracking-[0.08em] uppercase">Lelu</span>
              </div>
              <p className="mt-3 max-w-[260px] text-[12.5px] leading-relaxed text-[#8E8E93] dark:text-[#5A5C66]">
                Open-source authorization engine for AI agents. Every action checked, every decision logged.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 text-[13px]">
              <div>
                <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[#8E8E93] dark:text-[#5A5C66]">Product</p>
                <ul className="space-y-2 text-[#737373] dark:text-[#8B8D98]">
                  <li><Link href="/docs" className="hover:text-[#0A0A0A] dark:hover:text-white transition-colors">Docs</Link></li>
                  <li><Link href="/pricing" className="hover:text-[#0A0A0A] dark:hover:text-white transition-colors">Pricing</Link></li>
                  <li><Link href="/sandbox" className="hover:text-[#0A0A0A] dark:hover:text-white transition-colors">Sandbox</Link></li>
                  <li><Link href="/policies" className="hover:text-[#0A0A0A] dark:hover:text-white transition-colors">Policies</Link></li>
                  <li><Link href="/audit" className="hover:text-[#0A0A0A] dark:hover:text-white transition-colors">Audit Log</Link></li>
                </ul>
              </div>
              <div>
                <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[#8E8E93] dark:text-[#5A5C66]">Company</p>
                <ul className="space-y-2 text-[#737373] dark:text-[#8B8D98]">
                  <li><Link href="/about" className="hover:text-[#0A0A0A] dark:hover:text-white transition-colors">About</Link></li>
                  <li><a href="https://github.com/lelu-ai/lelu" target="_blank" rel="noreferrer" className="hover:text-[#0A0A0A] dark:hover:text-white transition-colors">GitHub</a></li>
                  <li><a href="https://github.com/lelu-ai/lelu/discussions" target="_blank" rel="noreferrer" className="hover:text-[#0A0A0A] dark:hover:text-white transition-colors">Discussions</a></li>
                </ul>
              </div>
              <div>
                <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[#8E8E93] dark:text-[#5A5C66]">Social</p>
                <ul className="space-y-2 text-[#737373] dark:text-[#8B8D98]">
                  <li><a href="https://x.com/LeluAuth" target="_blank" rel="noreferrer" className="hover:text-[#0A0A0A] dark:hover:text-white transition-colors">X / Twitter</a></li>
                  <li><a href="https://github.com/lelu-ai/lelu" target="_blank" rel="noreferrer" className="hover:text-[#0A0A0A] dark:hover:text-white transition-colors">GitHub</a></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#E7E5E4] dark:border-white/[0.06] pt-6 text-[12px] text-[#8E8E93] dark:text-[#5A5C66]">
            <span>© {new Date().getFullYear()} Lelu. MIT licensed.</span>
            <span className="font-mono">every action checked · every decision logged</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
