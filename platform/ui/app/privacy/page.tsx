import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Lock, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy | Lelu",
  description: "Privacy Policy explaining how Lelu handles agent trace logs, authorization telemetry, and data security.",
};

export default function PrivacyPage() {
  const lastUpdated = "August 4, 2026";

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0B10] text-[#18181B] dark:text-[#EDEEF0] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation Breadcrumb */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[13px] font-medium text-[#737373] dark:text-[#8B8D98] hover:text-[#0A0A0A] dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>

        {/* Page Header */}
        <div className="border-b border-[#E7E5E4] dark:border-[#20222B] pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[12px] font-mono font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            Data Protection & Privacy
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0A0A0A] dark:text-white">
            Privacy Policy
          </h1>
          <p className="mt-3 text-[14px] text-[#737373] dark:text-[#8B8D98]">
            Last updated: {lastUpdated}
          </p>
        </div>

        {/* Privacy Policy Content Body */}
        <div className="space-y-8 text-[15px] leading-relaxed text-[#3F3F46] dark:text-[#C9C9D2]">
          <section className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-[#0A0A0A] dark:text-white mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-emerald-500" />
              1. Local-First & Zero-Trust Architecture
            </h2>
            <p>
              Lelu is engineered with local-first authorization principles. When running via <code className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono text-xs">npx lelu-mcp start</code>, your agent authorization policies, decision traces, and evaluation context remain inside your local environment (`~/.lelu`). No credentials or prompt context leave your system unless cloud synchronization is explicitly enabled.
            </p>
          </section>

          <section className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-[#0A0A0A] dark:text-white mb-4">
              2. Information We Collect
            </h2>
            <p className="mb-4">
              When utilizing Lelu Cloud platform dashboard features or hosted APIs, we collect:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-[#52525B] dark:text-[#A1A1AA]">
              <li><strong>Account Credentials:</strong> Email address and authentication profiles for dashboard access.</li>
              <li><strong>Agent Audit Telemetry:</strong> Action types, decision outcomes (allow, deny, human review), and confidence scores required for compliance logs.</li>
              <li><strong>Usage Metrics:</strong> System performance, API call frequency, and error logs for diagnostic optimization.</li>
            </ul>
          </section>

          <section className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-[#0A0A0A] dark:text-white mb-4">
              3. Data Security & Encryption
            </h2>
            <p>
              All stored telemetry data is encrypted at rest using AES-256 and transmitted using TLS 1.3 encryption. API key secrets are hashed using argon2 and are never stored in plaintext format.
            </p>
          </section>

          <section className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-[#0A0A0A] dark:text-white mb-4">
              4. Data Retention & Deletion
            </h2>
            <p>
              Audit traces are stored according to your organization's retention policy. You may delete telemetry records or request complete account erasure at any time via the admin dashboard or by reaching out to privacy@lelu.ai.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
