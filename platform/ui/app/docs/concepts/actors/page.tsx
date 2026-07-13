import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Actors",
  description: "What an actor is in Lelu — the identity that requests an authorization decision.",
};

export default function ActorsPage() {
  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-[34px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white leading-tight mb-3">
          Actors
        </h1>
        <p className="text-[15px] text-[#737373] leading-relaxed">
          An actor is the identity making an authorization request — the "who" in every decision.
        </p>
      </div>

      <hr className="border-[#E7E5E4] dark:border-[#20222B] mb-10" />

      <div className="space-y-12">

        <section>
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-3">
            Overview
          </h2>
          <p className="text-[15px] text-[#737373] leading-[1.7]">
            In traditional authorization systems the actor is almost always a human user. In
            agentic systems it's usually an AI process — a billing agent, a customer-support
            bot, a code-review pipeline. Lelu treats any string identifier as a valid actor
            so you can model agents, users, services, and sub-agents within the same policy
            engine.
          </p>
        </section>

        <section>
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-4">
            Actor identifiers
          </h2>
          <p className="text-[15px] text-[#737373] leading-[1.7] mb-5">
            Pass any stable string as the <code className="text-[13px] font-mono bg-[#F5F5F4] dark:bg-[#0D0E13] px-1.5 py-0.5 rounded text-[#0A0A0A] dark:text-[#E4E4E7]">actor</code> field.
            Conventional formats that work well:
          </p>
          <div className="rounded-lg border border-[#E7E5E4] dark:border-[#20222B] overflow-hidden mb-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E7E5E4] dark:border-[#20222B] bg-[#F5F5F4] dark:bg-[#0D0E13]">
                  <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.04em] uppercase text-[#737373]">Format</th>
                  <th className="px-4 py-3 text-[12px] font-semibold tracking-[0.04em] uppercase text-[#737373]">Example</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Agent name", "billing-agent"],
                  ["Namespaced agent", "org/billing-agent"],
                  ["User ID", "user:abc123"],
                  ["Service account", "svc:data-pipeline"],
                  ["Sub-agent", "parent-agent/child-agent"],
                ].map(([format, example], i) => (
                  <tr key={format} className={`border-b border-[#E7E5E4] dark:border-[#20222B] last:border-0 ${i % 2 === 0 ? "bg-white dark:bg-[#0A0B10]" : "bg-[#FAFAFA] dark:bg-[#0D0D0F]"}`}>
                    <td className="px-4 py-3 text-[13px] text-[#0A0A0A] dark:text-[#E4E4E7]">{format}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[#0A0A0A] dark:text-[#E4E4E7]">{example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-4">
            Using actors in policies
          </h2>
          <p className="text-[15px] text-[#737373] leading-[1.7] mb-4">
            Inside a Rego policy the actor is available as <code className="text-[13px] font-mono bg-[#F5F5F4] dark:bg-[#0D0E13] px-1.5 py-0.5 rounded text-[#0A0A0A] dark:text-[#E4E4E7]">input.actor</code>.
          </p>
          <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#20222B]">
            <div className="px-3 py-2 bg-[#F5F5F4] dark:bg-[#0D0E13] border-b border-[#E7E5E4] dark:border-[#20222B] text-[11px] font-semibold text-[#737373] tracking-[0.06em] uppercase">policy.rego</div>
            <pre className="p-5 bg-white dark:bg-[#0A0B10] text-[13px] font-mono text-[#0A0A0A] dark:text-[#E4E4E7] leading-relaxed overflow-x-auto">{`allow {
  input.actor == "billing-agent"
  input.action == "refund:process"
  input.context.confidence >= 0.9
}

# Deny all unknown actors by default
deny {
  not startswith(input.actor, "org/")
}`}</pre>
          </div>
        </section>

        <section className="flex gap-3 flex-wrap pt-2">
          <Link href="/docs/concepts/actions" className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] rounded-md hover:opacity-80 transition-opacity">
            Next: Actions →
          </Link>
          <Link href="/docs/concepts/decisions" className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium border border-[#E7E5E4] dark:border-[#20222B] text-[#0A0A0A] dark:text-white rounded-md hover:bg-[#F5F5F4] dark:hover:bg-[#0D0E13] transition-colors">
            Decisions
          </Link>
        </section>

      </div>
    </div>
  );
}
