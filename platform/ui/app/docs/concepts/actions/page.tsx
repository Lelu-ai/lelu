import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Actions",
  description: "What an action is in Lelu — the operation an actor wants to perform.",
};

export default function ActionsPage() {
  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-[34px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white leading-tight mb-3">
          Actions
        </h1>
        <p className="text-[15px] text-[#737373] leading-relaxed">
          An action is the operation an actor wants to perform — the "what" in every decision.
        </p>
      </div>

      <hr className="border-[#E7E5E4] dark:border-[#20222B] mb-10" />

      <div className="space-y-12">

        <section>
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-3">
            Overview
          </h2>
          <p className="text-[15px] text-[#737373] leading-[1.7]">
            Actions are arbitrary strings that describe what an agent is about to do. They carry no
            implicit semantics — your policies define what each action means. A common convention is
            to use a <code className="text-[13px] font-mono bg-[#F5F5F4] dark:bg-[#0D0E13] px-1.5 py-0.5 rounded text-[#0A0A0A] dark:text-[#E4E4E7]">resource:verb</code> format,
            but any consistent scheme works.
          </p>
        </section>

        <section>
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-4">
            Naming conventions
          </h2>
          <div className="rounded-lg border border-[#E7E5E4] dark:border-[#20222B] overflow-hidden mb-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E7E5E4] dark:border-[#20222B] bg-[#F5F5F4] dark:bg-[#0D0E13]">
                  <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.04em] uppercase text-[#737373]">Style</th>
                  <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.04em] uppercase text-[#737373]">Examples</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["resource:verb", "refund:process, email:send, file:delete"],
                  ["verb only", "read, write, execute"],
                  ["dotted path", "billing.refund.process"],
                  ["free-form", "send_customer_email"],
                ].map(([style, examples], i) => (
                  <tr key={style} className={`border-b border-[#E7E5E4] dark:border-[#20222B] last:border-0 ${i % 2 === 0 ? "bg-white dark:bg-[#0A0B10]" : "bg-[#FAFAFA] dark:bg-[#0D0D0F]"}`}>
                    <td className="px-4 py-3 font-mono text-[12px] text-[#0A0A0A] dark:text-[#E4E4E7]">{style}</td>
                    <td className="px-4 py-3 text-[13px] text-[#737373]">{examples}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3 p-4 rounded-md bg-[#F5F5F4] dark:bg-[#0D0E13] border-l-[3px] border-[#0A0A0A] dark:border-white text-[13px] text-[#737373]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5 text-[#0A0A0A] dark:text-white"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Pick one convention and stick with it across your entire policy set. Mixed formats make
            wildcard rules harder to write.
          </div>
        </section>

        <section>
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-4">
            Passing an action
          </h2>
          <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#20222B]">
            <div className="px-3 py-2 bg-[#F5F5F4] dark:bg-[#0D0E13] border-b border-[#E7E5E4] dark:border-[#20222B] text-[11px] font-semibold text-[#737373] tracking-[0.06em] uppercase">TypeScript</div>
            <pre className="p-5 bg-white dark:bg-[#0A0B10] text-[13px] font-mono text-[#0A0A0A] dark:text-[#E4E4E7] leading-relaxed overflow-x-auto">{`const decision = await lelu.agentAuthorize({
  actor: "billing-agent",
  action: "refund:process",       // <-- the action
  resource: "order/ord_abc123",
  context: { confidence: 0.91, amount_usd: 250 },
});`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-4">
            Matching actions in policies
          </h2>
          <p className="text-[15px] text-[#737373] leading-[1.7] mb-4">
            Use <code className="text-[13px] font-mono bg-[#F5F5F4] dark:bg-[#0D0E13] px-1.5 py-0.5 rounded text-[#0A0A0A] dark:text-[#E4E4E7]">input.action</code> in Rego to match exactly or with prefix checks.
          </p>
          <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#20222B]">
            <div className="px-3 py-2 bg-[#F5F5F4] dark:bg-[#0D0E13] border-b border-[#E7E5E4] dark:border-[#20222B] text-[11px] font-semibold text-[#737373] tracking-[0.06em] uppercase">policy.rego</div>
            <pre className="p-5 bg-white dark:bg-[#0A0B10] text-[13px] font-mono text-[#0A0A0A] dark:text-[#E4E4E7] leading-relaxed overflow-x-auto">{`# Exact match
allow {
  input.action == "refund:process"
}

# Prefix match — allow any read action
allow {
  startswith(input.action, "read:")
}

# Route high-risk actions to human review
require_human_review {
  input.action == "refund:process"
  input.context.amount_usd > 500
}`}</pre>
          </div>
        </section>

        <section className="flex gap-3 flex-wrap pt-2">
          <Link href="/docs/concepts/resources" className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] rounded-md hover:opacity-80 transition-opacity">
            Next: Resources →
          </Link>
          <Link href="/docs/concepts/actors" className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium border border-[#E7E5E4] dark:border-[#20222B] text-[#0A0A0A] dark:text-white rounded-md hover:bg-[#F5F5F4] dark:hover:bg-[#0D0E13] transition-colors">
            ← Actors
          </Link>
        </section>

      </div>
    </div>
  );
}
