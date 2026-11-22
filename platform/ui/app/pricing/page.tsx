"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import PlanCta from "@/components/billing/PlanCta";
import { OVERAGE_BLOCK, OVERAGE_USD_PER_BLOCK, PLANS, type PlanId } from "@/lib/billing/plans";

/* ── Pricing: per authorize call, never per seat ───────────────────── */

const fmt = (n: number) => n.toLocaleString("en-US");
const OVERAGE = `$${OVERAGE_USD_PER_BLOCK.toFixed(2)} per ${fmt(OVERAGE_BLOCK)} calls`;
const DISCUSSIONS = "https://github.com/lelu-ai/lelu/discussions";

interface Tier {
  id: PlanId;
  price: string;
  period: string;
  tagline: string;
  features: string[];
  cta:
    | { kind: "link"; label: string; href: string }
    | { kind: "plan"; label: string; plan: "starter" | "growth" }
    | { kind: "external"; label: string; href: string };
  badge?: string;
  highlight?: boolean;
}

const TIERS: Tier[] = [
  {
    id: "free",
    price: "$0",
    period: "month",
    tagline: "Try Lelu on a real project.",
    features: [
      `${fmt(PLANS.free.includedCalls)} authorize calls a month`,
      "Stops at the limit, so never a surprise bill",
      "Unlimited agents and team members",
      "Hosted engine, dashboard and policy editor",
      "Slack human-review approvals",
      `${PLANS.free.auditRetentionDays}-day audit history`,
      "Community support",
    ],
    cta: { kind: "link", label: "Start free", href: "/register" },
  },
  {
    id: "starter",
    price: `$${PLANS.starter.priceUsd}`,
    period: "month",
    tagline: "For small teams running agents in production.",
    features: [
      `${fmt(PLANS.starter.includedCalls)} authorize calls a month`,
      `Then ${OVERAGE}, never blocked`,
      "Unlimited agents and team members",
      "Unlimited audit history",
      "Email support",
      "Billed monthly, cancel any time",
    ],
    cta: { kind: "plan", label: "Choose Starter", plan: "starter" },
    badge: "Recommended",
    highlight: true,
  },
  {
    id: "growth",
    price: `$${PLANS.growth.priceUsd}`,
    period: "month",
    tagline: "For scaling production workloads.",
    features: [
      `${fmt(PLANS.growth.includedCalls)} authorize calls a month`,
      `Then ${OVERAGE}, never blocked`,
      "Everything in Starter",
      "Priority support in a shared Slack channel",
      "Billed monthly, cancel any time",
    ],
    cta: { kind: "plan", label: "Choose Growth", plan: "growth" },
  },
  {
    id: "enterprise",
    price: "Custom",
    period: "annual",
    tagline: "For custom volume, deployment and compliance.",
    features: [
      "Custom authorize-call volume",
      "Annual billing",
      "Help running the engine in your own infrastructure",
      "SSO / SAML / OIDC and SIEM audit export (coming soon)",
      "Custom integrations",
    ],
    cta: { kind: "external", label: "Talk to us", href: DISCUSSIONS },
  },
];

// Comparison table: one row per feature, one cell per plan in TIERS order.
const COMPARE: { label: string; cells: [string, string, string, string] }[] = [
  { label: "Monthly price", cells: ["$0", `$${PLANS.starter.priceUsd}`, `$${PLANS.growth.priceUsd}`, "Custom"] },
  {
    label: "Authorize calls included",
    cells: [fmt(PLANS.free.includedCalls), fmt(PLANS.starter.includedCalls), fmt(PLANS.growth.includedCalls), "Custom"],
  },
  { label: "Past the included calls", cells: ["Paused until the 1st", OVERAGE, OVERAGE, "Custom"] },
  { label: "Agents and team members", cells: ["Unlimited", "Unlimited", "Unlimited", "Unlimited"] },
  { label: "Audit history", cells: [`${PLANS.free.auditRetentionDays} days`, "Unlimited", "Unlimited", "Unlimited"] },
  { label: "Policy editor, sandbox, Slack approvals", cells: ["✓", "✓", "✓", "✓"] },
  { label: "Support", cells: ["Community", "Email", "Priority, shared Slack", "Dedicated"] },
  { label: "Self-hosting help, custom integrations", cells: ["—", "—", "—", "✓"] },
];

const FAQ = [
  {
    q: "What counts as an authorize call?",
    a: "Each live call to /v1/authorize made with a cloud API key counts as one. Sandbox calls, using the dashboard and managing agents or keys do not count.",
  },
  {
    q: "What happens when I reach my plan's calls?",
    a: `On Free, calls past ${fmt(PLANS.free.includedCalls)} are declined with a clear quota error until the 1st of the month, and you are never charged. On Starter and Growth your agents keep running: extra calls cost ${OVERAGE}, rounded up to the next ${fmt(OVERAGE_BLOCK)}, and are added to your next invoice.`,
  },
  {
    q: "How do upgrades and downgrades work?",
    a: "Switch any time from this page. An upgrade starts immediately and charges the prorated difference. A downgrade also switches immediately, and the unused part of the higher price is credited on your next bill.",
  },
  {
    q: "Why per call and not per agent?",
    a: "Agents are cheap to create and you should not have to ration them. Every plan has unlimited agents and team members; you pay for the authorization work Lelu does.",
  },
  {
    q: "Is the self-hosted engine really free?",
    a: "Yes. The engine, SDKs, MCP server and dashboard are MIT-licensed. Run npx -y lelu-mcp start, or deploy it yourself, with no account and no limits. The plans above are for the hosted cloud.",
  },
  {
    q: "Can I pay annually or get a custom volume?",
    a: "Yes, on Enterprise. Open a discussion and we will set up annual billing or a custom call volume for your account.",
  },
  {
    q: "How do I pay, and can I cancel?",
    a: "Plans are billed monthly in US dollars through Paddle, our merchant of record, and sales tax or VAT is added at checkout. Manage or cancel any time from the Manage billing button on your dashboard.",
  },
];

const CARD_LINK =
  "mt-6 rounded-md border border-[#D6D3D1] dark:border-white/[0.12] px-4 py-2.5 text-center text-[13.5px] font-medium text-[#0A0A0A] dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0B10] text-[#18181B] dark:text-[#EDEEF0] antialiased">
      {/* Head */}
      <section className="px-4 pt-16 sm:pt-20 pb-8 text-center">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.08em] text-[#0A0A0A] dark:text-white font-mono">
          Pricing
        </span>
        <h1 className="mx-auto mt-3 max-w-2xl text-[30px] sm:text-[38px] font-semibold tracking-tight text-[#0A0A0A] dark:text-white leading-[1.15]">
          Start free. Pay for calls, not seats.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[#737373] dark:text-[#8B8D98]">
          Every plan has unlimited agents and team members. Paid plans never stop your agents at a limit; extra
          calls are simply billed at {OVERAGE}.
        </p>
      </section>

      {/* Self-host strip */}
      <section className="px-4 pb-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 rounded-2xl border border-[#E7E5E4] dark:border-white/[0.06] bg-white dark:bg-[#0D0E13]/60 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[14.5px] font-semibold text-[#0A0A0A] dark:text-white">
              Open source: $0, forever, on your own machines
            </p>
            <p className="mt-1 text-[13px] text-[#737373] dark:text-[#8B8D98]">
              The full engine, MIT-licensed, with unlimited calls. No account needed:{" "}
              <code className="font-mono text-[12px]">npx -y lelu-mcp start</code>
            </p>
          </div>
          <Link href="/docs/quickstart" className={`${CARD_LINK} mt-0 shrink-0`}>
            Self-host guide
          </Link>
        </div>
      </section>

      {/* Tiers */}
      <section className="px-4 pb-14">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((t, i) => (
            <motion.div
              key={t.id}
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
                <h2 className="text-[16px] font-semibold text-[#0A0A0A] dark:text-white">{PLANS[t.id].name}</h2>
                {t.badge && (
                  <span className="rounded-full border border-[#30A46C]/50 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[#30A46C]">
                    {t.badge}
                  </span>
                )}
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
              {t.cta.kind === "plan" ? (
                <PlanCta plan={t.cta.plan} label={t.cta.label} primary={!!t.highlight} />
              ) : t.cta.kind === "external" ? (
                <a href={t.cta.href} target="_blank" rel="noreferrer" className={CARD_LINK}>
                  {t.cta.label}
                </a>
              ) : (
                <Link href={t.cta.href} className={CARD_LINK}>
                  {t.cta.label}
                </Link>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* Compare */}
      <section className="px-4 pb-16">
        <div className="mx-auto max-w-6xl overflow-x-auto rounded-2xl border border-[#E7E5E4] dark:border-white/[0.06] bg-white dark:bg-[#0D0E13]/60">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#E7E5E4] dark:border-white/[0.06]">
                <th className="p-4 font-medium text-[#737373] dark:text-[#8B8D98]">Compare plans</th>
                {TIERS.map((t) => (
                  <th key={t.id} className="p-4 font-semibold text-[#0A0A0A] dark:text-white">
                    {PLANS[t.id].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row) => (
                <tr key={row.label} className="border-b last:border-b-0 border-[#E7E5E4] dark:border-white/[0.06]">
                  <td className="p-4 text-[#3F3F46] dark:text-[#C9C9D2]">{row.label}</td>
                  {row.cells.map((c, i) => (
                    <td key={TIERS[i].id} className="p-4 text-[#0A0A0A] dark:text-white">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-[#E7E5E4] dark:border-white/[0.06] px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-[22px] font-semibold tracking-tight text-[#0A0A0A] dark:text-white">Questions</h2>
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
