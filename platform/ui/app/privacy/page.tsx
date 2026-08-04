"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FiShield,
  FiLock,
  FiDatabase,
  FiEye,
  FiMail,
  FiCheckCircle,
  FiChevronRight,
  FiServer,
  FiUserCheck,
} from "react-icons/fi";

const SECTIONS = [
  { id: "overview", title: "1. Overview & Privacy Commitment" },
  { id: "collection", title: "2. Information We Collect" },
  { id: "usage", title: "3. How We Process & Use Information" },
  { id: "agent-telemetry", title: "4. Agent Telemetry & Audit Trail Hashing" },
  { id: "sharing", title: "5. Data Sharing & Subprocessors" },
  { id: "security", title: "6. Data Security & Encryption Standards" },
  { id: "retention", title: "7. Data Retention & Account Deletion" },
  { id: "compliance", title: "8. Global Compliance (GDPR & CCPA/CPRA)" },
  { id: "user-rights", title: "9. Your Rights & Data Portability" },
  { id: "cookies", title: "10. Cookies, Sessions & Local Storage" },
  { id: "children", title: "11. Children's Privacy" },
  { id: "dpo-contact", title: "12. Policy Changes & Data Protection Officer" },
];

const PRIVACY_PILLARS = [
  {
    icon: <FiLock className="text-[#0A0A0A] dark:text-white" size={18} />,
    title: "Zero Model Training",
    desc: "Your agent prompts, tool parameters, and payload data are strictly confidential and never used to train public or private LLM models.",
  },
  {
    icon: <FiDatabase className="text-[#0A0A0A] dark:text-white" size={18} />,
    title: "Encrypted Audit Hashes",
    desc: "Every evaluation event produces cryptographically verifiable SHA-256 input/output hashes stored in encrypted audit logs.",
  },
  {
    icon: <FiServer className="text-[#0A0A0A] dark:text-white" size={18} />,
    title: "Tenant Isolation",
    desc: "Data schemas and evaluation states are strictly isolated per workspace using AES-256-GCM encryption at rest.",
  },
  {
    icon: <FiUserCheck className="text-[#0A0A0A] dark:text-white" size={18} />,
    title: "Full Data Ownership",
    desc: "Export your complete audit history, security policies, and team activity logs at any time in machine-readable format.",
  },
];

export default function PrivacyPage() {
  const [activeSection, setActiveSection] = useState("overview");

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
              Privacy & Data Protection
            </span>
            <span className="text-[12px] text-[#737373]">Effective: August 4, 2026</span>
          </div>
          <h1 className="text-[32px] sm:text-[42px] font-bold tracking-[-0.03em] text-[#0A0A0A] dark:text-white leading-tight mb-4">
            Privacy Policy
          </h1>
          <p className="text-[16px] text-[#737373] max-w-3xl leading-relaxed">
            At Lelu AI, security and data privacy are foundational to everything we build. This Privacy Policy details how we collect, safeguard, process, and handle information when you interact with our AI agent authorization engine, dashboard, APIs, and SDKs.
          </p>
        </div>

        {/* ── Privacy Highlights Grid ───────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-14">
          {PRIVACY_PILLARS.map((p, i) => (
            <div
              key={i}
              className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-5 shadow-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-[#F4F4F5] dark:bg-[#12141A] flex items-center justify-center mb-3">
                {p.icon}
              </div>
              <h3 className="text-[14px] font-bold text-[#0A0A0A] dark:text-white mb-1">
                {p.title}
              </h3>
              <p className="text-[12px] text-[#737373] leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>

        {/* ── Layout: Table of Contents + Main Body ───────────────────── */}
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
                <p className="text-[12px] text-[#737373] mb-3">Privacy or DPO inquiries?</p>
                <a
                  href="mailto:privacy@lelu-ai.com"
                  className="inline-flex items-center gap-2 text-[13px] font-bold text-[#0A0A0A] dark:text-white hover:underline"
                >
                  <FiMail size={14} /> privacy@lelu-ai.com
                </a>
              </div>
            </div>
          </aside>

          {/* Main Legal Content */}
          <main className="lg:col-span-8 space-y-12 text-[14px] text-[#52525B] dark:text-zinc-300 leading-relaxed">
            {/* Section 1 */}
            <section id="overview" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white">
                1. Overview & Privacy Commitment
              </h2>
              <p>
                Lelu AI provides infrastructure that sits between autonomous AI agents and downstream execution APIs or enterprise tools. Because security and confidentiality are core to authorization, we adhere to strict data minimization principles. We collect only what is strictly necessary to evaluate agent policies, log verifiable execution audit trails, and operate our platform securely.
              </p>
            </section>

            {/* Section 2 */}
            <section id="collection" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white">
                2. Information We Collect
              </h2>
              <p>We collect information in three main categories:</p>
              
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-[#F4F4F5] dark:bg-[#12141A] border border-[#E7E5E4] dark:border-[#20222B]">
                  <h4 className="font-bold text-[#0A0A0A] dark:text-white mb-1 text-[13px]">A. Account & Contact Information</h4>
                  <p className="text-[13px] text-[#737373] dark:text-zinc-400">
                    Full name, business email address, password hash (via bcrypt/argon2), organization name, and billing details processed by our PCI-DSS compliant payment provider.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#F4F4F5] dark:bg-[#12141A] border border-[#E7E5E4] dark:border-[#20222B]">
                  <h4 className="font-bold text-[#0A0A0A] dark:text-white mb-1 text-[13px]">B. Agent Evaluation & Policy Telemetry</h4>
                  <p className="text-[13px] text-[#737373] dark:text-zinc-400">
                    Agent identifiers, action names (e.g. <code className="text-[12px] bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded">database.write</code>), policy evaluation status (allow/deny/review), confidence scores, evaluation latency, and SHA-256 payload hashes.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#F4F4F5] dark:bg-[#12141A] border border-[#E7E5E4] dark:border-[#20222B]">
                  <h4 className="font-bold text-[#0A0A0A] dark:text-white mb-1 text-[13px]">C. Technical & Diagnostic Information</h4>
                  <p className="text-[13px] text-[#737373] dark:text-zinc-400">
                    IP address, user agent, API key ID, SDK version (TypeScript/Python), timestamp, HTTP response status, and diagnostic error tracebacks.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section id="usage" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white">
                3. How We Process & Use Information
              </h2>
              <p>We process Customer data strictly for the following purposes:</p>
              <ul className="list-disc pl-5 space-y-2 text-[#737373] dark:text-zinc-400">
                <li>Evaluating real-time agent authorization requests against Customer&apos;s security policies.</li>
                <li>Routing low-confidence actions to human approval queues and sending webhook notifications.</li>
                <li>Constructing immutable, cryptographically verifiable audit logs for compliance and post-mortem analysis.</li>
                <li>Preventing malicious traffic, prompt injection attacks, API key abuse, and rate-limit violations.</li>
                <li>Sending essential transactional messages (email verification, security alerts, invoice receipts).</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section id="agent-telemetry" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white">
                4. Agent Telemetry & Audit Trail Hashing
              </h2>
              <p>
                To reconcile strict auditability with privacy, Lelu employs <strong className="text-[#0A0A0A] dark:text-white">Cryptographic Payload Hashing</strong>:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-[#737373] dark:text-zinc-400">
                <li>Input parameters and output payloads can be hashed locally or on-the-fly into SHA-256 signatures before storage in our centralized audit engine.</li>
                <li>Customers retaining raw payload logging can configure payload encryption keys, ensuring raw tool arguments are accessible only to authorized team members within Customer&apos;s organization.</li>
                <li>Raw agent prompt text is never exposed to third parties or logged unencrypted.</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section id="sharing" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white">
                5. Data Sharing & Subprocessors
              </h2>
              <p>
                We do not sell, rent, or trade personal data or customer agent telemetry to advertisers or data brokers. Data is shared only with trusted subprocessors strictly necessary to operate our infrastructure:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-[#737373] dark:text-zinc-400">
                <li><strong className="text-[#0A0A0A] dark:text-white">Cloud Hosting & Infrastructure:</strong> AWS / Vercel (Encrypted data centers).</li>
                <li><strong className="text-[#0A0A0A] dark:text-white">Database & Search Engine:</strong> Managed PostgreSQL and Redis clusters with TLS 1.3 encryption.</li>
                <li><strong className="text-[#0A0A0A] dark:text-white">Transactional Email:</strong> Amazon SES / Postmark for security alerts and verification links.</li>
                <li><strong className="text-[#0A0A0A] dark:text-white">OAuth Providers:</strong> GitHub / Google (if Customer selects social sign-in).</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section id="security" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white">
                6. Data Security & Encryption Standards
              </h2>
              <p>
                Lelu implements enterprise-grade technical and organizational safeguards:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-[#737373] dark:text-zinc-400">
                <li><strong className="text-[#0A0A0A] dark:text-white">Encryption in Transit:</strong> All web traffic, API calls, and webhook communications enforce TLS 1.3 with strict HSTS policies.</li>
                <li><strong className="text-[#0A0A0A] dark:text-white">Encryption at Rest:</strong> All database storage, audit logs, and backups are encrypted using AES-256-GCM.</li>
                <li><strong className="text-[#0A0A0A] dark:text-white">Non-Human Identity (NHI) Protection:</strong> API keys and service tokens are salted and hashed; raw tokens are shown only once upon creation.</li>
                <li><strong className="text-[#0A0A0A] dark:text-white">Access Control:</strong> Strict Role-Based Access Control (RBAC) and least-privilege principles govern internal administrative access.</li>
              </ul>
            </section>

            {/* Section 7 */}
            <section id="retention" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white">
                7. Data Retention & Account Deletion
              </h2>
              <p>
                <strong className="text-[#0A0A0A] dark:text-white">Audit Log Retention:</strong> By default, evaluation audit records are retained for 90 days (or longer depending on Customer&apos;s subscription plan).
              </p>
              <p>
                <strong className="text-[#0A0A0A] dark:text-white">Account Termination:</strong> Upon account closure or written deletion request, Lelu permanently purges all Customer policies, API keys, and stored telemetry within 30 days, except where retention is required for legal or tax compliance.
              </p>
            </section>

            {/* Section 8 */}
            <section id="compliance" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white">
                8. Global Compliance (GDPR & CCPA/CPRA)
              </h2>
              <p>
                Lelu complies with applicable data privacy regulations, including the European Union General Data Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA/CPRA).
              </p>
              <p>
                For European users, Lelu serves as a Data Processor for agent evaluation telemetry and a Data Controller for Customer account credentials. Standard Contractual Clauses (SCCs) and Data Processing Addendums (DPAs) are available for Enterprise customers upon request.
              </p>
            </section>

            {/* Section 9 */}
            <section id="user-rights" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white">
                9. Your Rights & Data Portability
              </h2>
              <p>Depending on your jurisdiction, you possess the right to:</p>
              <ul className="list-disc pl-5 space-y-2 text-[#737373] dark:text-zinc-400">
                <li>Access a copy of your personal data and account records.</li>
                <li>Rectify inaccurate or incomplete account information.</li>
                <li>Export audit logs and custom policies in JSON / CSV format.</li>
                <li>Request the deletion (&quot;Right to be Forgotten&quot;) of your account data.</li>
                <li>Object to or restrict certain data processing activities.</li>
              </ul>
              <p>
                To exercise any of these rights, contact us at <a href="mailto:privacy@lelu-ai.com" className="text-[#0A0A0A] dark:text-white font-semibold underline">privacy@lelu-ai.com</a>.
              </p>
            </section>

            {/* Section 10 */}
            <section id="cookies" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white">
                10. Cookies, Sessions & Local Storage
              </h2>
              <p>
                We use essential session cookies and local storage tokens strictly for user authentication, security validation (CSRF protection), and maintaining user theme preferences (dark/light mode). We do not use intrusive third-party tracking cookies or advertising pixels.
              </p>
            </section>

            {/* Section 11 */}
            <section id="children" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white">
                11. Children&apos;s Privacy
              </h2>
              <p>
                Our Service is designed for developers, security professionals, and enterprises. We do not knowingly solicit or collect personal information from individuals under the age of 18.
              </p>
            </section>

            {/* Section 12 */}
            <section id="dpo-contact" className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white">
                12. Policy Changes & Data Protection Officer
              </h2>
              <p>
                We may update this Privacy Policy from time to time to reflect technological changes, security enhancements, or legal requirements. Material updates will be communicated via email or dashboard notification prior to taking effect.
              </p>
              <div className="pt-4 flex flex-col sm:flex-row gap-4">
                <a
                  href="mailto:privacy@lelu-ai.com"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] font-bold text-[13px] hover:opacity-90 transition-opacity"
                >
                  <FiMail size={15} /> Contact Privacy Team
                </a>
                <Link
                  href="/terms"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E7E5E4] dark:border-[#20222B] bg-transparent text-[#0A0A0A] dark:text-white font-bold text-[13px] hover:bg-[#F5F5F4] dark:hover:bg-[#12141A] transition-colors"
                >
                  <FiShield size={15} /> View Terms of Service
                </Link>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
