import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Policies",
  description: "How Lelu policies work — Rego rules that define allow, deny, and require_human_review outcomes.",
};

export default function PoliciesConceptPage() {
  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-[34px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white leading-tight mb-3">
          Policies
        </h1>
        <p className="text-[15px] text-[#737373] leading-relaxed">
          Policies are Rego rules that control every authorization decision — allow, deny, or
          route to human review.
        </p>
      </div>

      <hr className="border-[#E7E5E4] dark:border-[#20222B] mb-10" />

      <div className="space-y-12">

        <section>
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-3">
            Overview
          </h2>
          <p className="text-[15px] text-[#737373] leading-[1.7]">
            Lelu uses{" "}
            <a href="https://www.openpolicyagent.org/docs/latest/policy-language/" target="_blank" rel="noreferrer" className="text-[#0A0A0A] dark:text-white underline underline-offset-2 hover:opacity-70 transition-opacity">
              Rego
            </a>{" "}
            — the same language as Open Policy Agent — for its policy engine. Policies are
            stored server-side, versioned, and evaluated on every{" "}
            <code className="text-[13px] font-mono bg-[#F5F5F4] dark:bg-[#0D0E13] px-1.5 py-0.5 rounded text-[#0A0A0A] dark:text-[#E4E4E7]">agentAuthorize</code> call.
            Your application code never needs to change when policy rules change.
          </p>
        </section>

        <section>
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-4">
            The three outcomes
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[
              {
                label: "allow",
                color: "emerald",
                desc: "The action proceeds immediately. The agent continues without interruption.",
              },
              {
                label: "deny",
                color: "red",
                desc: "The action is blocked. The decision is logged and returned to the agent.",
              },
              {
                label: "require_human_review",
                color: "amber",
                desc: "The action is queued. The agent waits until a human approves or rejects it.",
              },
            ].map((o) => (
              <div key={o.label} className="rounded-lg border border-[#E7E5E4] dark:border-[#20222B] p-4">
                <code className={`text-[12px] font-mono font-bold ${o.color === "emerald" ? "text-emerald-500" : o.color === "red" ? "text-red-500" : "text-amber-500"}`}>
                  {o.label}
                </code>
                <p className="text-[13px] text-[#737373] mt-2 leading-relaxed">{o.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-4">
            Policy structure
          </h2>
          <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#20222B]">
            <div className="px-3 py-2 bg-[#F5F5F4] dark:bg-[#0D0E13] border-b border-[#E7E5E4] dark:border-[#20222B] text-[11px] font-semibold text-[#737373] tracking-[0.06em] uppercase">policy.rego</div>
            <pre className="p-5 bg-white dark:bg-[#0A0B10] text-[13px] font-mono text-[#0A0A0A] dark:text-[#E4E4E7] leading-relaxed overflow-x-auto">{`package lelu

# Allow billing agent to process small refunds with high confidence
allow {
  input.actor == "billing-agent"
  input.action == "refund:process"
  input.context.confidence >= 0.9
  input.context.amount_usd <= 100
}

# Route large refunds to human review regardless of confidence
require_human_review {
  input.action == "refund:process"
  input.context.amount_usd > 100
}

# Deny all file deletions
deny {
  startswith(input.action, "file:delete")
}`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-4">
            The input object
          </h2>
          <p className="text-[15px] text-[#737373] leading-[1.7] mb-4">
            Every policy evaluation receives the following input:
          </p>
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
                  ["input.actor", "string", "Identity making the request"],
                  ["input.action", "string", "Operation being performed"],
                  ["input.resource", "string", "Target of the action (optional)"],
                  ["input.context", "object", "Arbitrary key-value metadata including confidence"],
                  ["input.context.confidence", "number", "0.0–1.0 confidence score from the agent"],
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

        <section className="flex gap-3 flex-wrap pt-2">
          <Link href="/docs/concepts/decisions" className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] rounded-md hover:opacity-80 transition-opacity">
            Next: Decisions →
          </Link>
          <Link href="/docs/concepts/resources" className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium border border-[#E7E5E4] dark:border-[#20222B] text-[#0A0A0A] dark:text-white rounded-md hover:bg-[#F5F5F4] dark:hover:bg-[#0D0E13] transition-colors">
            ← Resources
          </Link>
        </section>

      </div>
    </div>
  );
}
