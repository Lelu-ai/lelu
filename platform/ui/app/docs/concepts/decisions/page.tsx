import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Decisions",
  description: "The decision object returned by Lelu — allowed, denied, or queued for human review.",
};

export default function DecisionsPage() {
  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-[34px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white leading-tight mb-3">
          Decisions
        </h1>
        <p className="text-[15px] text-[#737373] leading-relaxed">
          Every call to <code className="text-[13px] font-mono bg-[#F5F5F4] dark:bg-[#0D0E13] px-1.5 py-0.5 rounded">agentAuthorize</code> returns
          a decision object your agent uses to branch its behavior.
        </p>
      </div>

      <hr className="border-[#E7E5E4] dark:border-[#20222B] mb-10" />

      <div className="space-y-12">

        <section>
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-4">
            Decision shape
          </h2>
          <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#20222B] mb-6">
            <div className="px-3 py-2 bg-[#F5F5F4] dark:bg-[#0D0E13] border-b border-[#E7E5E4] dark:border-[#20222B] text-[11px] font-semibold text-[#737373] tracking-[0.06em] uppercase">TypeScript</div>
            <pre className="p-5 bg-white dark:bg-[#0A0B10] text-[13px] font-mono text-[#0A0A0A] dark:text-[#E4E4E7] leading-relaxed overflow-x-auto">{`interface Decision {
  allowed: boolean;
  requiresHumanReview: boolean;
  reason?: string;       // policy-provided explanation
  reviewId?: string;     // present when requiresHumanReview is true
  decisionId: string;    // unique ID for audit trail lookups
  evaluatedAt: string;   // ISO-8601 timestamp
}`}</pre>
          </div>

          <div className="rounded-lg border border-[#E7E5E4] dark:border-[#20222B] overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E7E5E4] dark:border-[#20222B] bg-[#F5F5F4] dark:bg-[#0D0E13]">
                  <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.04em] uppercase text-[#737373]">Field</th>
                  <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.04em] uppercase text-[#737373]">Type</th>
                  <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.04em] uppercase text-[#737373]">Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["allowed", "boolean", "True if the policy returned allow"],
                  ["requiresHumanReview", "boolean", "True if queued — agent should pause and poll"],
                  ["reason", "string?", "Optional human-readable explanation from the policy"],
                  ["reviewId", "string?", "ID to poll when requiresHumanReview is true"],
                  ["decisionId", "string", "Unique identifier for this evaluation, usable in audit queries"],
                  ["evaluatedAt", "string", "ISO-8601 timestamp of when the decision was made"],
                ].map(([field, type, desc], i) => (
                  <tr key={field as string} className={`border-b border-[#E7E5E4] dark:border-[#20222B] last:border-0 ${i % 2 === 0 ? "bg-white dark:bg-[#0A0B10]" : "bg-[#FAFAFA] dark:bg-[#0D0D0F]"}`}>
                    <td className="px-4 py-3 font-mono text-[12px] text-[#0A0A0A] dark:text-[#E4E4E7]">{field}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[#737373]">{type}</td>
                    <td className="px-4 py-3 text-[13px] text-[#737373]">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-4">
            Branching on a decision
          </h2>
          <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#20222B]">
            <div className="px-3 py-2 bg-[#F5F5F4] dark:bg-[#0D0E13] border-b border-[#E7E5E4] dark:border-[#20222B] text-[11px] font-semibold text-[#737373] tracking-[0.06em] uppercase">TypeScript</div>
            <pre className="p-5 bg-white dark:bg-[#0A0B10] text-[13px] font-mono text-[#0A0A0A] dark:text-[#E4E4E7] leading-relaxed overflow-x-auto">{`const decision = await lelu.agentAuthorize({
  actor: "billing-agent",
  action: "refund:process",
  resource: "order/ord_abc123",
  context: { confidence: 0.88, amount_usd: 250 },
});

if (decision.allowed) {
  // proceed — policy returned allow
  await processRefund(orderId);

} else if (decision.requiresHumanReview) {
  // pause — queue the action and wait for human approval
  await notifyReviewer(decision.reviewId);
  // poll /v1/reviews/{reviewId} until resolved

} else {
  // blocked — policy returned deny
  console.log("Denied:", decision.reason);
}`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-4">
            Decision precedence
          </h2>
          <p className="text-[15px] text-[#737373] leading-[1.7] mb-4">
            When multiple rules fire simultaneously, Lelu applies this order:
          </p>
          <ol className="space-y-2">
            {[
              { n: "1", label: "deny", desc: "Any deny rule wins immediately." },
              { n: "2", label: "require_human_review", desc: "Queues the action if no deny fired." },
              { n: "3", label: "allow", desc: "Proceeds only if no deny or review rule fired." },
              { n: "4", label: "implicit deny", desc: "No rule matched — denied by default." },
            ].map((row) => (
              <li key={row.n} className="flex items-start gap-3 text-[14px]">
                <span className="flex-none w-6 h-6 rounded-full border border-[#E7E5E4] dark:border-[#20222B] flex items-center justify-center text-[12px] font-semibold text-[#0A0A0A] dark:text-white shrink-0 mt-0.5">{row.n}</span>
                <span>
                  <code className="text-[12px] font-mono font-bold text-[#0A0A0A] dark:text-[#E4E4E7] bg-[#F5F5F4] dark:bg-[#0D0E13] px-1.5 py-0.5 rounded">{row.label}</code>
                  <span className="text-[#737373] ml-2">{row.desc}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex gap-3 flex-wrap pt-2">
          <Link href="/docs/concepts/api" className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] rounded-md hover:opacity-80 transition-opacity">
            Next: Agent Authorize API →
          </Link>
          <Link href="/docs/concepts/policies" className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium border border-[#E7E5E4] dark:border-[#20222B] text-[#0A0A0A] dark:text-white rounded-md hover:bg-[#F5F5F4] dark:hover:bg-[#0D0E13] transition-colors">
            ← Policies
          </Link>
        </section>

      </div>
    </div>
  );
}
