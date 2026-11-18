"use client";

import Link from "next/link";
import ProCta from "@/components/billing/ProCta";
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
    highlight: false,
    badge: "Free forever",
  },
  {
    name: "Cloud Free",
    price: "$0",
    period: "free tier",
    tagline: "Hosted engine and dashboard, run by us.",
    features: [
      "Free account — 1,000 authorize calls/month",
      "Up to 3 registered agents",
      "Managed engine — nothing to deploy",
      "Web dashboard & policy editor",
      "Hosted audit history",
      "Slack human-review approvals",
      "Sandbox environment",
    ],
    cta: { label: "Create free account", href: "/register" },
    highlight: false,
    badge: "Account required",
  },
  {
    name: "Pro",
    price: "$20",
    period: "month",
    tagline: "More headroom for agents running in production.",
    features: [
      "100,000 authorize calls/month (100× the free tier)",
      "Up to 50 registered agents",
      "Everything in Cloud Free",
      "Email support",
      "Cancel any time from your dashboard",
    ],
    cta: { label: "Upgrade to Pro", href: "/dashboard", checkout: true },
    highlight: true,
    badge: "For production",
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
    a: "The engine, SDKs, MCP server, and dashboard are MIT-licensed open source — self-host everything with no limits, forever. The hosted cloud has a free tier (1,000 authorize calls/month and 3 registered agents, no credit card) and a $20/month Pro plan for more.",
  },
  {
    q: "What do I get with Pro?",
    a: "100,000 authorize calls a month instead of 1,000, and up to 50 registered agents instead of 3. Everything else in the hosted cloud is the same as the free tier. If you need more than Pro offers, open a discussion and we will talk.",
  },
  {
    q: "Do I need an account?",
    a: "No, for local/self-hosted — run npx -y lelu-mcp start and accept any API key you choose at startup, nothing to sign up for. Yes, for the hosted cloud dashboard and cloud API keys — create a free account to get started.",
  },
  {
    q: "What happens if I go over my monthly quota?",
    a: "Requests beyond your plan's monthly limit are declined with a clear quota error and are never billed as overage. You can upgrade to Pro from the dashboard, or self-host, where there is no limit.",
  },
  {
    q: "How do I pay, and can I cancel?",
    a: "Pro is billed monthly in US dollars at checkout, and applicable sales tax or VAT is added there. You can manage or cancel your subscription any time from the Manage billing button on your dashboard.",
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
          Free to self-host. $20/month when you need more.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[#737373] dark:text-[#8B8D98]">
          Self-host the full engine forever — no account, no credit card, no signup.
          Prefer the hosted dashboard? Start on the free cloud tier, and upgrade to Pro when your agents
          outgrow it.
        </p>
      </section>

      {/* Tiers */}
      <section className="px-4 pb-16">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              {"checkout" in t.cta && t.cta.checkout ? (
                <ProCta label={t.cta.label} />
              ) : t.cta.external ? (
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
        <p className="mx-auto mt-6 max-w-6xl text-center font-mono text-[11.5px] text-[#8E8E93] dark:text-[#5A5C66]">
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
