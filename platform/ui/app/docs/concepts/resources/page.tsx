import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Resources",
  description: "What a resource is in Lelu — the object an action is performed on.",
};

export default function ResourcesPage() {
  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-[34px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white leading-tight mb-3">
          Resources
        </h1>
        <p className="text-[15px] text-[#737373] leading-relaxed">
          A resource is the object an action targets — the "on what" in every decision.
        </p>
      </div>

      <hr className="border-[#E7E5E4] dark:border-[#27272A] mb-10" />

      <div className="space-y-12">

        <section>
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-3">
            Overview
          </h2>
          <p className="text-[15px] text-[#737373] leading-[1.7]">
            The <code className="text-[13px] font-mono bg-[#F5F5F4] dark:bg-[#0D0E13] px-1.5 py-0.5 rounded text-[#0A0A0A] dark:text-[#E4E4E7]">resource</code> field
            is optional but recommended for any action that targets a specific entity. It lets
            policies enforce fine-grained rules — for example, allowing a refund on orders under
            $100 but routing larger ones to human review regardless of confidence.
          </p>
        </section>

        <section>
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-4">
            Resource identifier formats
          </h2>
          <div className="rounded-lg border border-[#E7E5E4] dark:border-[#27272A] overflow-hidden mb-5">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E7E5E4] dark:border-[#27272A] bg-[#F5F5F4] dark:bg-[#0D0E13]">
                  <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.04em] uppercase text-[#737373]">Format</th>
                  <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.04em] uppercase text-[#737373]">Example</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["type/id", "order/ord_abc123"],
                  ["ARN-style", "arn:lelu:billing::order/ord_abc123"],
                  ["path-style", "/customers/cust_42/orders/ord_abc"],
                  ["opaque ID", "ord_abc123"],
                ].map(([format, example], i) => (
                  <tr key={format} className={`border-b border-[#E7E5E4] dark:border-[#27272A] last:border-0 ${i % 2 === 0 ? "bg-white dark:bg-[#0A0B10]" : "bg-[#FAFAFA] dark:bg-[#0D0D0F]"}`}>
                    <td className="px-4 py-3 font-mono text-[12px] text-[#0A0A0A] dark:text-[#E4E4E7]">{format}</td>
                    <td className="px-4 py-3 text-[13px] text-[#737373]">{example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-4">
            Example
          </h2>
          <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#27272A] mb-6">
            <div className="px-3 py-2 bg-[#F5F5F4] dark:bg-[#0D0E13] border-b border-[#E7E5E4] dark:border-[#27272A] text-[11px] font-semibold text-[#737373] tracking-[0.06em] uppercase">TypeScript</div>
            <pre className="p-5 bg-white dark:bg-[#0A0B10] text-[13px] font-mono text-[#0A0A0A] dark:text-[#E4E4E7] leading-relaxed overflow-x-auto">{`const decision = await lelu.agentAuthorize({
  actor: "billing-agent",
  action: "refund:process",
  resource: "order/ord_abc123",   // <-- the resource
  context: { confidence: 0.88, amount_usd: 75 },
});`}</pre>
          </div>

          <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#27272A]">
            <div className="px-3 py-2 bg-[#F5F5F4] dark:bg-[#0D0E13] border-b border-[#E7E5E4] dark:border-[#27272A] text-[11px] font-semibold text-[#737373] tracking-[0.06em] uppercase">policy.rego</div>
            <pre className="p-5 bg-white dark:bg-[#0A0B10] text-[13px] font-mono text-[#0A0A0A] dark:text-[#E4E4E7] leading-relaxed overflow-x-auto">{`# Allow refunds under $100 automatically
allow {
  input.action == "refund:process"
  startswith(input.resource, "order/")
  input.context.amount_usd <= 100
  input.context.confidence >= 0.85
}

# Route large refunds to human review
require_human_review {
  input.action == "refund:process"
  input.context.amount_usd > 100
}`}</pre>
          </div>
        </section>

        <section className="flex gap-3 flex-wrap pt-2">
          <Link href="/docs/concepts/policies" className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] rounded-md hover:opacity-80 transition-opacity">
            Next: Policies →
          </Link>
          <Link href="/docs/concepts/actions" className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium border border-[#E7E5E4] dark:border-[#27272A] text-[#0A0A0A] dark:text-white rounded-md hover:bg-[#F5F5F4] dark:hover:bg-[#0D0E13] transition-colors">
            ← Actions
          </Link>
        </section>

      </div>
    </div>
  );
}
