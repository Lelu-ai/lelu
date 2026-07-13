"use client";

import Link from "next/link";
import { motion } from "framer-motion";

/* ── Pricing — free while in beta, no accounts ─────────────────────── */

const TIERS = [
  {
    name: "Open Source",
    price: "$0",
    period: "forever",
    tagline: "The full engine, on your infrastructure.",
    features: [
      "Self-hosted engine — one command",
      "Unlimited agents, actions & API calls",
      "Policy engine (YAML + Rego)",
      "Prompt-injection filtering",
      "Confidence gating & audit log",
      "MCP server for Claude Code / Cursor",
      "MIT licensed · community support",
    ],
    cta: { label: "Start now", href: "/docs/quickstart" },
    highlight: true,
    badge: "Free today",
  },
  {
    name: "Cloud",
    price: "$0",
    period: "during beta",
    tagline: "Hosted engine and dashboard, run by us.",
    features: [
      "Managed engine — nothing to deploy",
      "Web dashboard & policy editor",
      "Hosted audit history",
      "Slack human-review approvals",
      "Sandbox environment",
      "Fair-use limits while in beta",
    ],
    cta: {
      label: "Get early access",
      href: "https://github.com/lelu-ai/lelu/discussions",
      external: true,
    },
    highlight: false,
    badge: "Early access",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "annual",
    tagline: "For teams with compliance requirements.",
    features: [
      "Custom deployments & networking",
      "SSO / SAML / OIDC",
      "SIEM audit export",
      "Custom integrations",
      "Dedicated support & SLA",
    ],
    cta: {
      label: "Talk to us",
      href: "https://github.com/lelu-ai/lelu/discussions",
      external: true,
    },
    highlight: false,
    badge: "Coming soon",
  },
];

const FAQ = [
  {
    q: "Is it really free?",
    a: "Yes. The engine, SDKs, MCP server, and dashboard are MIT-licensed open source — self-host everything with no limits, forever. The hosted cloud is also free while it's in beta.",
  },
  {
    q: "Do I need an account?",
    a: "No. There is no signup and no login today. The local engine runs with npx -y lelu-mcp start and accepts any API key you choose at startup.",
  },
  {
    q: "What happens when cloud pricing launches?",
    a: "The open-source tier stays free forever — that's the point of MIT licensing. Cloud beta users will get generous notice and a founding-user discount before anything is billed.",
  },
  {
    q: "How do I get early access to the cloud version?",
    a: "Open a thread in GitHub Discussions and tell us about your use case — we onboard new teams every week.",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0B10] text-[#18181B] dark:text-[#EDEEF0] antialiased">
      {/* Head */}
      <section className="px-4 pt-16 sm:pt-20 pb-10 text-center">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.08em] text-[#0A0A0A] dark:text-white font-mono">
          Pricing
        </span>
        <h1 className="mx-auto mt-3 max-w-2xl text-[30px] sm:text-[38px] font-semibold tracking-tight text-[#0A0A0A] dark:text-white leading-[1.15]">
          Free while we build.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[#737373] dark:text-[#8B8D98]">
          No accounts, no credit card, no signup. Self-host the full engine forever,
          or ask for early access to the hosted beta.
        </p>
      </section>

      {/* Tiers */}
      <section className="px-4 pb-16">
        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
          {TIERS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className={`flex flex-col rounded-2xl border p-6 ${
                t.highlight
                  ? "border-[#3B82F6]/50 bg-white dark:bg-[#0D0E13] shadow-[0_0_50px_rgba(59,130,246,0.08)]"
                  : "border-[#E7E5E4] dark:border-white/[0.06] bg-white dark:bg-[#0D0E13]/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-semibold text-[#0A0A0A] dark:text-white">{t.name}</h2>
                <span
                  className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] ${
                    t.highlight
                      ? "border-[#30A46C]/50 text-[#30A46C]"
                      : "border-[#E7E5E4] dark:border-white/[0.1] text-[#8E8E93] dark:text-[#5A5C66]"
                  }`}
                >
                  {t.badge}
                </span>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-[34px] font-semibold tracking-tight text-[#0A0A0A] dark:text-white">{t.price}</span>
                <span className="text-[13px] text-[#8E8E93] dark:text-[#5A5C66]">/ {t.period}</span>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-[#737373] dark:text-[#8B8D98]">{t.tagline}</p>
              <ul className="mt-5 space-y-2.5 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] text-[#3F3F46] dark:text-[#C9C9D2]">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mt-0.5 shrink-0 text-[#30A46C]">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              {t.cta.external ? (
                <a
                  href={t.cta.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 rounded-md border border-[#D6D3D1] dark:border-white/[0.12] px-4 py-2.5 text-center text-[13.5px] font-medium text-[#0A0A0A] dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors"
                >
                  {t.cta.label}
                </a>
              ) : (
                <Link
                  href={t.cta.href}
                  className="mt-6 rounded-md bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6] px-4 py-2.5 text-center text-[13.5px] font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  {t.cta.label}
                </Link>
              )}
            </motion.div>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-5xl text-center font-mono text-[11.5px] text-[#8E8E93] dark:text-[#5A5C66]">
          $ npx -y lelu-mcp start&nbsp;&nbsp;·&nbsp;&nbsp;the full engine, running locally, in under a minute
        </p>
      </section>

      {/* FAQ */}
      <section className="border-t border-[#E7E5E4] dark:border-white/[0.06] px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-[22px] font-semibold tracking-tight text-[#0A0A0A] dark:text-white">
            Questions
          </h2>
          <div className="mt-8 space-y-6">
            {FAQ.map((f) => (
              <div key={f.q} className="rounded-xl border border-[#E7E5E4] dark:border-white/[0.06] bg-white dark:bg-[#0D0E13]/60 p-5">
                <p className="text-[14.5px] font-semibold text-[#0A0A0A] dark:text-white">{f.q}</p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-[#737373] dark:text-[#8B8D98]">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
