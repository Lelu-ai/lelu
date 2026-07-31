"use client";

import Link from "next/link";
import { FaGithub, FaNpm, FaPython } from "react-icons/fa6";
import { FiBook, FiExternalLink, FiFileText, FiMail, FiShield } from "react-icons/fi";

const TEAM = [
  {
    initials: "AG",
    name: "Abenezer Getachew",
    role: "Founder",
    title: "Software Developer · AI Researcher",
    bio: [
      "Software developer and AI researcher with deep expertise in security infrastructure, distributed systems, and autonomous agent design.",
      "Built Lelu from the ground up — engine, SDKs, and platform — driven by the conviction that AI agents need purpose-built authorization infrastructure before they can be trusted in production.",
    ],
    links: [
      { label: "GitHub", href: "https://github.com/Abenezer0923", icon: <FaGithub /> },
      { label: "Contact", href: "mailto:abenezerg@lelu-ai.com", icon: <FiMail /> },
    ],
    avatarBg: "bg-[#0A0A0A] dark:bg-[#20222B]",
    badge: "bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A]",
  },
  {
    initials: "B",
    name: "Bereket",
    role: "Team",
    title: "Software Developer · UI/UX Designer",
    bio: [
      "Full-stack developer and UI/UX designer responsible for Lelu's platform interface, design system, and developer experience.",
      "Shapes how developers interact with Lelu — from the sandbox playground to the audit dashboard — ensuring security primitives feel approachable and intuitive.",
    ],
    links: [],
    avatarBg: "bg-zinc-600 dark:bg-zinc-700",
    badge: "bg-[#F4F4F5] dark:bg-white/10 text-[#737373] dark:text-zinc-300",
  },
];

const ADVISOR = {
  initials: "TD",
  name: "Tadese Destaw",
  role: "Advisor",
  title: "PhD Candidate · AI Researcher",
  bio: "PhD candidate and active AI researcher advising Lelu on the frontier of autonomous agent behavior, model safety, and AI decision-making. Brings academic depth to Lelu's approach to confidence scoring, behavioral anomaly detection, and agent trust frameworks.",
  avatarBg: "bg-gradient-to-br from-violet-600 to-indigo-600",
  badge: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400",
};

const OVERVIEW = [
  { label: "Company", value: "Lelu AI" },
  { label: "Founded", value: "2026" },
  { label: "Founder", value: "Abenezer Getachew" },
  { label: "Team", value: "3 members + 1 advisor" },
  { label: "Product", value: "Authorization Engine for AI Agents" },
  { label: "Status", value: "Live — 2,000+ SDK downloads" },
  { label: "SDKs", value: "TypeScript, Python" },
  { label: "License", value: "Open Source (MIT)" },
];

const LINKS = [
  { name: "GitHub", icon: <FaGithub />, href: "https://github.com/lelu-ai/lelu" },
  { name: "npm Package", icon: <FaNpm />, href: "https://www.npmjs.com/package/lelu-agent-auth" },
  { name: "PyPI Package", icon: <FaPython />, href: "https://pypi.org/project/lelu-agent-auth-sdk" },
  { name: "Documentation", icon: <FiBook />, href: "/docs" },
  { name: "Research Paper", icon: <FiFileText />, href: "/paper.pdf" },
];

const PAPER = {
  title: "A Confidence You Can Measure",
  subtitle: "Validating Confidence-Gated Authorization for AI Agents",
  abstract:
    "Authorization systems for AI agents increasingly propose gating actions on model confidence — allow a tool call when the model is confident, escalate or deny when it isn't. We test that premise directly: a reproducible AUROC benchmark over 321,105 real answers from 15 chat models shows confidence separates correct from incorrect actions with an overall AUROC of 0.709, reaching 0.83 on the strongest models (GPT-4o).",
  author: "Abenezer Getachew",
};

const WHAT_WE_BUILT = [
  { title: "Confidence-Aware Gating", desc: "Every agent action carries a confidence score. Low-confidence actions route to human review automatically — no code change needed." },
  { title: "Human-in-the-Loop Review", desc: "Agents pause, queue their action, and resume once a human approves or denies. Full audit trail included." },
  { title: "Policy Enforcement", desc: "Write YAML or Rego policies to express complex rules. Allow, deny, or require review — per actor, action, or resource." },
  { title: "Complete Audit Trail", desc: "Every decision is logged with full context, input hash, output hash, latency, and confidence score for compliance and debugging." },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0B10]">
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-16">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div>
          <p className="text-[12px] text-[#A3A3A3] uppercase tracking-widest font-semibold mb-3">About</p>
          <h1 className="text-[30px] sm:text-[38px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white leading-tight mb-4">
            Lelu AI
          </h1>
          <p className="text-[16px] text-[#737373] leading-relaxed max-w-2xl">
            We are building authorization infrastructure for autonomous AI agents — the security
            layer that decides what an agent is allowed to do before it acts.
          </p>
        </div>

        {/* ── Company Overview ──────────────────────────────────────── */}
        <section>
          <h2 className="text-[18px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white mb-5">
            Company Overview
          </h2>
          <div className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-[#E7E5E4] dark:divide-[#20222B]">
              {OVERVIEW.map((item) => (
                <div key={item.label} className="p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#A3A3A3] mb-1.5">{item.label}</p>
                  <p className="text-[13px] font-semibold text-[#0A0A0A] dark:text-white leading-snug">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-[#E7E5E4] dark:border-[#20222B] p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#A3A3A3] mb-4">Links</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {LINKS.map((l) => (
                  <a
                    key={l.name}
                    href={l.href}
                    target={l.href.startsWith("http") ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#F4F4F5] dark:bg-[#12141A] border border-[#E7E5E4] dark:border-[#20222B] hover:border-[#0A0A0A] dark:hover:border-white/30 transition-colors group"
                  >
                    <div className="flex items-center gap-2 text-[13px] font-medium text-[#0A0A0A] dark:text-white">
                      <span className="text-base">{l.icon}</span>
                      {l.name}
                    </div>
                    <FiExternalLink className="text-[#A3A3A3] group-hover:text-[#0A0A0A] dark:group-hover:text-white transition-colors" size={12} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Mission ────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-[18px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white mb-5">
            Mission
          </h2>
          <div className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 space-y-4 text-[15px] text-[#737373] leading-relaxed">
            <p>
              AI agents are powerful enough to take real actions — processing refunds, modifying
              databases, sending emails, making business decisions. But traditional authorization
              systems were not built for AI. They assume deterministic, human-driven actions.
            </p>
            <p>
              AI agents operate with uncertainty, make probabilistic decisions, and can be
              manipulated through prompt injection attacks. Companies need a security layer
              designed specifically for autonomous AI.
            </p>
            <p className="text-[#0A0A0A] dark:text-white font-semibold border-l-2 border-[#0A0A0A] dark:border-white pl-4">
              Lelu provides the security infrastructure that makes AI agents safe for production —
              allowing companies to move fast without breaking things.
            </p>
          </div>
        </section>

        {/* ── What We Built ──────────────────────────────────────────── */}
        <section>
          <h2 className="text-[18px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white mb-5">
            What We Built
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {WHAT_WE_BUILT.map((item) => (
              <div
                key={item.title}
                className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-5"
              >
                <p className="text-[13px] font-bold text-[#0A0A0A] dark:text-white mb-2">{item.title}</p>
                <p className="text-[13px] text-[#737373] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Research ───────────────────────────────────────────────── */}
        <section>
          <h2 className="text-[18px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white mb-5">
            Research
          </h2>
          <div className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-7">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#F4F4F5] dark:bg-[#12141A] flex items-center justify-center shrink-0">
                <FiFileText className="text-[#737373]" size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[16px] font-bold text-[#0A0A0A] dark:text-white leading-snug">
                  {PAPER.title}
                </p>
                <p className="text-[13px] font-medium text-[#737373] mb-3">{PAPER.subtitle}</p>
                <p className="text-[13px] text-[#737373] leading-relaxed mb-4">{PAPER.abstract}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href="/paper.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] text-[12px] font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
                  >
                    <FiFileText size={13} /> Read the paper (PDF)
                  </a>
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-[#A3A3A3]">
                    {PAPER.author}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Team ───────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-[18px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white mb-5">
            Team
          </h2>
          <div className="space-y-3">
            {TEAM.map((person) => (
              <div
                key={person.name}
                className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row gap-5"
              >
                <div className={`w-14 h-14 rounded-xl ${person.avatarBg} flex items-center justify-center text-white text-lg font-bold shrink-0`}>
                  {person.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-[15px] font-bold text-[#0A0A0A] dark:text-white">{person.name}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest ${person.badge}`}>
                      {person.role}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#A3A3A3] mb-3">{person.title}</p>
                  <div className="space-y-2">
                    {person.bio.map((line, i) => (
                      <p key={i} className="text-[13px] text-[#737373] leading-relaxed">{line}</p>
                    ))}
                  </div>
                  {person.links.length > 0 && (
                    <div className="flex gap-2 mt-4">
                      {person.links.map((l) => (
                        <a
                          key={l.label}
                          href={l.href}
                          target={l.href.startsWith("http") ? "_blank" : undefined}
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F4F4F5] dark:bg-[#12141A] border border-[#E7E5E4] dark:border-[#20222B] text-[12px] font-medium text-[#0A0A0A] dark:text-white hover:border-[#0A0A0A] dark:hover:border-white/30 transition-colors"
                        >
                          <span className="text-sm">{l.icon}</span>
                          {l.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Advisor */}
          <div className="mt-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#A3A3A3] mb-3 px-1">Advisor</p>
            <div className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row gap-5">
              <div className={`w-14 h-14 rounded-xl ${ADVISOR.avatarBg} flex items-center justify-center text-white text-lg font-bold shrink-0`}>
                {ADVISOR.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-[15px] font-bold text-[#0A0A0A] dark:text-white">{ADVISOR.name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest ${ADVISOR.badge}`}>
                    {ADVISOR.role}
                  </span>
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#A3A3A3] mb-3">{ADVISOR.title}</p>
                <p className="text-[13px] text-[#737373] leading-relaxed">{ADVISOR.bio}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Contact ────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-[18px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white mb-5">
            Contact
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href="mailto:abenezerg@lelu-ai.com"
              className="flex items-center gap-4 p-5 bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl hover:border-[#0A0A0A] dark:hover:border-white/30 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#F4F4F5] dark:bg-[#12141A] flex items-center justify-center shrink-0 group-hover:bg-[#0A0A0A] dark:group-hover:bg-white transition-colors">
                <FiMail className="text-[#737373] group-hover:text-white dark:group-hover:text-[#0A0A0A] transition-colors" size={16} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#A3A3A3] mb-0.5">General</p>
                <p className="text-[13px] font-semibold text-[#0A0A0A] dark:text-white">abenezerg@lelu-ai.com</p>
              </div>
            </a>
            <a
              href="mailto:security@lelu-ai.com"
              className="flex items-center gap-4 p-5 bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl hover:border-[#0A0A0A] dark:hover:border-white/30 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#F4F4F5] dark:bg-[#12141A] flex items-center justify-center shrink-0 group-hover:bg-[#0A0A0A] dark:group-hover:bg-white transition-colors">
                <FiShield className="text-[#737373] group-hover:text-white dark:group-hover:text-[#0A0A0A] transition-colors" size={16} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#A3A3A3] mb-0.5">Security</p>
                <p className="text-[13px] font-semibold text-[#0A0A0A] dark:text-white">security@lelu-ai.com</p>
              </div>
            </a>
          </div>
        </section>

        {/* ── Open Source ────────────────────────────────────────────── */}
        <section className="pb-4">
          <div className="bg-[#0A0A0A] dark:bg-[#0D0E13] rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-[13px] font-bold text-white mb-1">Open Source — MIT License</p>
              <p className="text-[13px] text-white/50 leading-relaxed max-w-md">
                Security infrastructure should be transparent and auditable. Self-host or use our managed platform.
              </p>
            </div>
            <Link
              href="https://github.com/lelu-ai/lelu"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-white text-[#0A0A0A] rounded-xl text-[13px] font-bold hover:bg-zinc-100 transition-colors"
            >
              <FaGithub size={15} /> View on GitHub
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
}
