"use client";

import React, { useState } from "react";
import Link from "next/link";
import { FaScaleBalanced } from "react-icons/fa6";
import {
  FiShield,
  FiFileText,
  FiLock,
  FiCheckCircle,
  FiAlertTriangle,
  FiMail,
  FiExternalLink,
  FiChevronRight,
  FiCpu,
} from "react-icons/fi";

const SECTIONS = [
  { id: "acceptance", title: "1. Agreement & Acceptance of Terms" },
  { id: "services", title: "2. Description of Services & Infrastructure" },
  { id: "accounts", title: "3. Account Credentials & API Key Security" },
  { id: "agent-governance", title: "4. Autonomous Agent Governance & Policy" },
  { id: "confidence-gating", title: "5. Confidence-Gated Authorization & Human-in-the-Loop" },
  { id: "data-rights", title: "6. Data Rights, Telemetry & Audit Logs" },
  { id: "open-source", title: "7. Open Source Licensing vs. Cloud Platform" },
  { id: "acceptable-use", title: "8. Acceptable Use Policy & Restrictions" },
  { id: "sla", title: "9. Service Levels, Availability & Maintenance" },
  { id: "billing", title: "10. Fees, Billing & Subscription Terms" },
  { id: "intellectual-property", title: "11. Intellectual Property Rights" },
  { id: "liability", title: "12. Limitation of Liability & Warranty Disclaimer" },
  { id: "indemnification", title: "13. Indemnification" },
  { id: "termination", title: "14. Termination & Suspension" },
  { id: "governing-law", title: "15. Governing Law & Contact Information" },
];

const HIGHLIGHTS = [
  {
    icon: <FiCpu className="text-[#0A0A0A] dark:text-white" size={18} />,
    title: "AI Action Governance",
    desc: "Lelu provides policy enforcement & confidence evaluation for autonomous agents before actions execute.",
  },
  {
    icon: <FiLock className="text-[#0A0A0A] dark:text-white" size={18} />,
    title: "Zero Model Training",
    desc: "Your prompt payloads, tool inputs, and decision hashes are never used to train global AI models.",
  },
  {
    icon: <FaScaleBalanced className="text-[#0A0A0A] dark:text-white" size={18} />,
    title: "Dual Licensing Model",
    desc: "Core engine & SDKs are open-source under the MIT license; hosted platform APIs operate under these cloud terms.",
  },
  {
    icon: <FiCheckCircle className="text-[#0A0A0A] dark:text-white" size={18} />,
    title: "Human Oversight SLAs",
    desc: "Confidence-gated actions routed to human review queues remain pending until explicit approval or timeout.",
  },
];

export default function TermsPage() {
  const [activeSection, setActiveSection] = useState("acceptance");

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      const yOffset = -80;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0B10] text-[#0A0A0A] dark:text-zinc-100 selection:bg-black/10 dark:selection:bg-white/20">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="mb-12 border-b border-[#E7E5E4] dark:border-[#20222B] pb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-widest bg-zinc-200/70 dark:bg-white/10 text-zinc-800 dark:text-zinc-200">
              Legal & Compliance
            </span>
            <span className="text-[12px] text-[#737373]">Effective: August 4, 2026</span>
          </div>
          <h1 className="text-[32px] sm:text-[42px] font-bold tracking-[-0.03em] text-[#0A0A0A] dark:text-white leading-tight mb-4">
            Terms of Service
          </h1>
          <p className="text-[16px] text-[#737373] max-w-3xl leading-relaxed">
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of Lelu AI&apos;s website, APIs, authorization engine, human-in-the-loop review system, software development kits (SDKs), and managed platform services.
          </p>
        </div>

        {/* ── Key Highlights Grid ───────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-14">
          {HIGHLIGHTS.map((h, i) => (
            <div
              key={i}
              className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-5 shadow-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-[#F4F4F5] dark:bg-[#12141A] flex items-center justify-center mb-3">
                {h.icon}
              </div>
              <h3 className="text-[14px] font-bold text-[#0A0A0A] dark:text-white mb-1">
                {h.title}
              </h3>
              <p className="text-[12px] text-[#737373] leading-relaxed">{h.desc}</p>
            </div>
          ))}
        </div>

        {/* ── Layout: Navigation Sidebar + Detailed Sections ─────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Sidebar Table of Contents */}
          <aside className="lg:col-span-4 hidden lg:block">
            <div className="sticky top-24 bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#A3A3A3] mb-4">
                Table of Contents
              </p>
              <nav className="space-y-1 max-h-[calc(100vh-160px)] overflow-y-auto pr-1">
                {SECTIONS.map((sec) => (
                  <button
                    key={sec.id}
                    onClick={() => scrollToSection(sec.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-colors flex items-center justify-between ${
                      activeSection === sec.id
                        ? "bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] font-semibold"
                        : "text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#12141A]"
                    }`}
                  >
                    <span className="truncate">{sec.title}</span>
                    <FiChevronRight
                      size={14}
                      className={`shrink-0 ml-1 transition-transform ${
                        activeSection === sec.id ? "translate-x-0.5" : "opacity-40"
                      }`}
                    />
                  </button>
                ))}
              </nav>

              <div className="mt-6 pt-5 border-t border-[#E7E5E4] dark:border-[#20222B]">
                <p className="text-[12px] text-[#737373] mb-3">Questions regarding our terms?</p>
                <a
                  href="mailto:legal@lelu-ai.com"
                  className="inline-flex items-center gap-2 text-[13px] font-bold text-[#0A0A0A] dark:text-white hover:underline"
                >
                  <FiMail size={14} /> legal@lelu-ai.com
                </a>
              </div>
            </div>
          </aside>

          {/* Main Legal Content */}
          <main className="lg:col-span-8 space-y-12 text-[14px] text-[#52525B] dark:text-zinc-300 leading-relaxed">
            {/* Section 1 */}
            <section id="acceptance" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white flex items-center gap-2">
                1. Agreement & Acceptance of Terms
              </h2>
              <p>
                By creating an account, integrating the Lelu SDKs, invoking Lelu APIs, or utilizing the Lelu Agent Authorization Platform (collectively, the &quot;Service&quot;), you (&quot;Customer,&quot; &quot;You,&quot; or &quot;User&quot;) agree to be legally bound by these Terms of Service. If you are accepting these Terms on behalf of an entity, company, or organization, you represent and warrant that you possess the legal authority to bind that organization.
              </p>
              <p>
                If you do not agree to all of the terms and conditions set forth herein, you must not access or use the Service.
              </p>
            </section>

            {/* Section 2 */}
            <section id="services" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white">
                2. Description of Services & Infrastructure
              </h2>
              <p>
                Lelu provides security and authorization infrastructure specifically engineered for autonomous AI agents, non-human identities (NHIs), and language-model-driven application tools. The Service encompasses:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-[#737373] dark:text-zinc-400">
                <li><strong className="text-[#0A0A0A] dark:text-white">Confidence-Aware Authorization Engine:</strong> Real-time evaluation of agent action requests, tool call parameters, confidence scores, and context against declarative security policies (YAML, Rego).</li>
                <li><strong className="text-[#0A0A0A] dark:text-white">Human-in-the-Loop Review System:</strong> Async queueing and routing mechanisms for low-confidence or high-risk agent actions requiring explicit human approval prior to execution.</li>
                <li><strong className="text-[#0A0A0A] dark:text-white">Audit Trail & Evidence Logging:</strong> Cryptographically linked logging of input/output hashes, policy evaluation decisions, actor metadata, and execution latency.</li>
                <li><strong className="text-[#0A0A0A] dark:text-white">Managed Platform & APIs:</strong> Hosted control plane, web dashboard, registry, and cloud endpoint routing.</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section id="accounts" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white">
                3. Account Credentials & API Key Security
              </h2>
              <p>
                To utilize the Service, you must register for an account and generate API access keys. You are solely responsible for:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-[#737373] dark:text-zinc-400">
                <li>Maintaining the strict confidentiality of your account credentials, passkeys, and API keys.</li>
                <li>Restricting access to API keys that carry administrative or policy modification privileges.</li>
                <li>All activities, requests, and policy decisions executed under your account credentials or API tokens.</li>
              </ul>
              <p>
                You must notify Lelu immediately at <a href="mailto:security@lelu-ai.com" className="text-[#0A0A0A] dark:text-white font-semibold underline">security@lelu-ai.com</a> if you discover or suspect any unauthorized use of your API keys or security compromise.
              </p>
            </section>

            {/* Section 4 */}
            <section id="agent-governance" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white">
                4. Autonomous Agent Governance & Policy Responsibility
              </h2>
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300 text-[13px] flex items-start gap-3">
                <FiAlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div>
                  <strong className="font-semibold block mb-0.5">Critical Notice on Autonomous Agent Actions</strong>
                  Lelu provides authorization guardrails and confidence scoring models, but Customer retains full operational responsibility for the actions, database mutations, external API calls, financial transfers, or downstream side-effects executed by Customer&apos;s AI agents.
                </div>
              </div>
              <p>
                Customer is solely responsible for authoring, configuring, and testing the security policies (allow/deny rules, confidence threshold boundaries, and approval workflows) deployed within the Lelu platform. Lelu does not guarantee that a given policy configuration will prevent all unauthorized or unintended AI model behaviors.
              </p>
            </section>

            {/* Section 5 */}
            <section id="confidence-gating" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white">
                5. Confidence-Gated Authorization & Human-in-the-Loop
              </h2>
              <p>
                When an agent action is evaluated by Lelu&apos;s confidence engine:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-[#737373] dark:text-zinc-400">
                <li><strong className="text-[#0A0A0A] dark:text-white">Allowed Actions:</strong> Actions exceeding specified confidence thresholds and matching allow policies are permitted to execute immediately.</li>
                <li><strong className="text-[#0A0A0A] dark:text-white">Escalated Actions:</strong> Actions falling below confidence thresholds or explicitly tagged for review are paused and placed into Customer&apos;s human review queue.</li>
                <li><strong className="text-[#0A0A0A] dark:text-white">Timeout & Expiration:</strong> Customer must configure review expiration behavior (e.g. auto-deny after 24 hours). Lelu is not liable for delayed business workflows caused by unreviewed items in Customer&apos;s queue.</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section id="data-rights" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white">
                6. Data Rights, Telemetry & Audit Logs
              </h2>
              <p>
                <strong className="text-[#0A0A0A] dark:text-white">Customer Ownership:</strong> Customer retains all rights, title, and interest in Customer Data, including agent prompts, response payloads, custom policies, and audit logs.
              </p>
              <p>
                <strong className="text-[#0A0A0A] dark:text-white">Zero Training Pledge:</strong> Lelu will never use Customer Data or audit log payloads to train foundational AI models or share customer data across tenant boundaries.
              </p>
              <p>
                <strong className="text-[#0A0A0A] dark:text-white">Usage Metrics:</strong> Lelu collects aggregated, anonymized operational metrics (e.g., policy evaluation count, latency percentiles, error rates) to maintain platform stability and improve performance.
              </p>
            </section>

            {/* Section 7 */}
            <section id="open-source" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white">
                7. Open Source Licensing vs. Cloud Platform
              </h2>
              <p>
                Lelu&apos;s core authorization engine and SDKs are distributed under the open-source <strong className="text-[#0A0A0A] dark:text-white">MIT License</strong>. You are free to inspect, modify, and self-host the open-source repository in accordance with the MIT license terms.
              </p>
              <p>
                These Terms of Service specifically apply to the hosted cloud infrastructure, managed dashboard, global control plane, multi-tenant database services, and enterprise API endpoints provided by Lelu AI.
              </p>
            </section>

            {/* Section 8 */}
            <section id="acceptable-use" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white">
                8. Acceptable Use Policy & Restrictions
              </h2>
              <p>You agree not to misuse the Service or assist any third party in doing so. Prohibited activities include:</p>
              <ul className="list-disc pl-5 space-y-2 text-[#737373] dark:text-zinc-400">
                <li>Attempting to bypass, disable, or tamper with Lelu&apos;s security controls or rate limit quotas.</li>
                <li>Using the Service to authorize malware execution, automated cyberattacks, unauthorized surveillance, or spam.</li>
                <li>Reverse engineering, decompiling, or probing the proprietary hosted components of the Service.</li>
                <li>Conducting denial-of-service (DoS) attacks against Lelu infrastructure.</li>
              </ul>
            </section>

            {/* Section 9 */}
            <section id="sla" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white">
                9. Service Levels, Availability & Maintenance
              </h2>
              <p>
                Lelu strives to maintain 99.9% uptime for production API endpoints. Scheduled maintenance windows will be communicated via our status page and email notifications. Enterprise SLA commitments are set forth in separate Enterprise Service Agreements.
              </p>
            </section>

            {/* Section 10 */}
            <section id="billing" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white">
                10. Fees, Billing & Subscription Terms
              </h2>
              <p>
                Certain features of the Service are offered on a paid subscription or usage basis (e.g. monthly API authorization calls, evaluation throughput, team seats). All fees are non-refundable except as required by law or explicitly stated in writing.
              </p>
            </section>

            {/* Section 11 */}
            <section id="intellectual-property" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white">
                11. Intellectual Property Rights
              </h2>
              <p>
                Lelu retains all right, title, and interest in and to the Service, including all software, branding, trademarks, logos, domain names, design patterns, and proprietary evaluation algorithms.
              </p>
            </section>

            {/* Section 12 */}
            <section id="liability" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white">
                12. Limitation of Liability & Warranty Disclaimer
              </h2>
              <p className="uppercase text-[12px] font-semibold tracking-wider text-[#A3A3A3]">
                Provided &quot;As Is&quot;
              </p>
              <p>
                THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, LELU AI DISCLAIMS ALL WARRANTIES, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
              </p>
              <p>
                IN NO EVENT SHALL LELU AI OR ITS OFFICERS, DIRECTORS, OR EMPLOYEES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM OR RELATED TO YOUR USE OF THE SERVICE OR AGENT ACTIONS AUTHORIZED THROUGH THE PLATFORM.
              </p>
            </section>

            {/* Section 13 */}
            <section id="indemnification" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white">
                13. Indemnification
              </h2>
              <p>
                You agree to defend, indemnify, and hold harmless Lelu AI and its affiliates from and against any claims, liabilities, damages, judgments, losses, and expenses (including reasonable attorney fees) arising out of or in connection with your breach of these Terms or your deployment of AI agents.
              </p>
            </section>

            {/* Section 14 */}
            <section id="termination" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white">
                14. Termination & Suspension
              </h2>
              <p>
                Lelu reserves the right to suspend or terminate your access to the Service at any time, with or without prior notice, in the event of a material violation of these Terms, non-payment, or security threat to our platform.
              </p>
            </section>

            {/* Section 15 */}
            <section id="governing-law" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white">
                15. Governing Law & Contact Information
              </h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of law principles.
              </p>
              <div className="pt-4 flex flex-col sm:flex-row gap-4">
                <a
                  href="mailto:legal@lelu-ai.com"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] font-bold text-[13px] hover:opacity-90 transition-opacity"
                >
                  <FiMail size={15} /> Contact Legal Team
                </a>
                <Link
                  href="/privacy"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E7E5E4] dark:border-[#20222B] bg-transparent text-[#0A0A0A] dark:text-white font-bold text-[13px] hover:bg-[#F5F5F4] dark:hover:bg-[#12141A] transition-colors"
                >
                  <FiShield size={15} /> View Privacy Policy
                </Link>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
