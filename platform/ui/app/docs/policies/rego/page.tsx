export default function DocsPoliciesRego() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">Rego Policies</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          For advanced use cases, Lelu supports Open Policy Agent (OPA) Rego policies.
          Write expressive, context-aware rules that go beyond simple pattern matching.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">When to use Rego</h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            Use the dashboard pattern-matching policies for most cases — they&apos;re simpler and
            faster. Use Rego when you need to:
          </p>
          <ul className="mt-3 space-y-1 text-zinc-600 dark:text-zinc-400">
            {[
              "Make decisions based on request metadata (IP, time of day, user role)",
              "Reference external data sources",
              "Combine multiple fields with complex boolean logic",
              "Enforce rate limits per actor within a policy",
            ].map((item, i) => (
              <li key={i} className="flex gap-2"><span className="mt-1 text-zinc-400">•</span><span>{item}</span></li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Example policy</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">policy.rego</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`package lelu.authz

import rego.v1

# Deny destructive ops outside business hours (UTC)
deny if {
  regex.match("delete|drop|truncate", input.tool)
  time.clock(time.now_ns())[0] < 8
}

deny if {
  regex.match("delete|drop|truncate", input.tool)
  time.clock(time.now_ns())[0] > 18
}

# Require human review for financial ops above $10k
human_review if {
  regex.match("transfer|payment", input.tool)
  to_number(input.args.amount) > 10000
}

# Allow everything else
allow if {
  not deny
  not human_review
}`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Uploading a Rego policy</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">curl</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`curl -X POST https://lelu-ai.com/api/v1/policies \\
  -H "Authorization: Bearer lelu_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "business-hours",
    "type": "rego",
    "content": "'"$(cat policy.rego | base64)"'"
  }'`}</pre>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a href="/docs/concepts/policies" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Previous: Policies
        </a>
        <a href="/docs/policies/versioning" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Next: Policy Versioning
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </a>
      </div>
    </div>
  );
}
