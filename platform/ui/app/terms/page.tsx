import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ShieldCheck, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service | Lelu",
  description: "Terms of Service and legal agreement for using the Lelu AI agent authorization engine.",
};

export default function TermsPage() {
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[12px] font-mono font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 mb-4">
            <FileText className="w-3.5 h-3.5" />
            Legal Agreement
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0A0A0A] dark:text-white">
            Terms of Service
          </h1>
          <p className="mt-3 text-[14px] text-[#737373] dark:text-[#8B8D98]">
            Last updated: {lastUpdated}
          </p>
        </div>

        {/* Terms Content Body */}
        <div className="space-y-8 text-[15px] leading-relaxed text-[#3F3F46] dark:text-[#C9C9D2]">
          <section className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-[#0A0A0A] dark:text-white mb-4">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using the Lelu AI agent authorization engine, MCP services, APIs, and dashboard platform ("Services"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you must not access or use the platform.
            </p>
          </section>

          <section className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-[#0A0A0A] dark:text-white mb-4">
              2. Agent Authorization & Responsibility
            </h2>
            <p className="mb-4">
              Lelu provides tools to evaluate, gate, and audit actions taken by autonomous software agents. You maintain full responsibility for:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-[#52525B] dark:text-[#A1A1AA]">
              <li>Configuring Rego and YAML policy definitions applied to your AI agents.</li>
              <li>Monitoring decision thresholds for human review and automated execution.</li>
              <li>Securing API keys and authentication tokens used by your applications.</li>
            </ul>
          </section>

          <section className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-[#0A0A0A] dark:text-white mb-4">
              3. Acceptable Use
            </h2>
            <p className="mb-4">
              You agree not to use Lelu to authorize, conceal, or facilitate:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-[#52525B] dark:text-[#A1A1AA]">
              <li>Malicious cyber operations, unauthorized data exfiltration, or system compromise.</li>
              <li>Bypassing mandatory safety filters or human oversight rules in high-risk automated workflows.</li>
              <li>Overwhelming or disrupting service operations through denial-of-service attacks.</li>
            </ul>
          </section>

          <section className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-[#0A0A0A] dark:text-white mb-4">
              4. Service Availability & SLA
            </h2>
            <p>
              While Lelu strives for zero-downtime execution and low latency evaluation for local and cloud engine deployments, the platform is provided on an "as is" and "as available" basis unless covered by an enterprise SLA agreement.
            </p>
          </section>

          <section className="bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-[#0A0A0A] dark:text-white mb-4">
              5. Contact & Legal Inquiries
            </h2>
            <p className="flex items-center gap-2">
              For legal inquiries regarding these terms, contact us at{" "}
              <a href="mailto:legal@lelu.ai" className="text-indigo-600 dark:text-indigo-400 underline font-medium">
                legal@lelu.ai
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
