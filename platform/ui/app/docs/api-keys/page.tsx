export default function ApiKeysPage() {
  return (
    <div className="w-full">
      {/* Title block */}
      <div className="mb-8">
        <h1
          id="api-keys"
          className="text-[34px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white leading-tight mb-3"
        >
          API Keys
        </h1>
        <p className="text-[15px] text-[#737373] leading-relaxed">
          How to generate, configure, and use API keys to authenticate with the Lelu engine.
        </p>
      </div>

      <div className="flex gap-3 p-4 rounded-md bg-blue-50 dark:bg-blue-900/10 border-l-[3px] border-blue-500 mb-10">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 shrink-0 mt-0.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <div className="text-[14px] text-[#0A0A0A] dark:text-[#FAFAFA] leading-relaxed">
          <strong>Running Lelu locally? You don&apos;t need an account or a key from this site.</strong>{" "}
          <code className="font-mono text-[12px] px-1 py-0.5 bg-white dark:bg-[#0D0E13] border border-blue-200 dark:border-blue-800/40 rounded">npx -y lelu-mcp start</code>{" "}
          handles auth automatically, and a self-hosted engine accepts any <code className="font-mono text-[12px] px-1 py-0.5 bg-white dark:bg-[#0D0E13] border border-blue-200 dark:border-blue-800/40 rounded">API_KEY</code> you choose at startup.
          The keys on this page are only for the <strong>hosted engine</strong> at lelu-ai.com.
        </div>
      </div>

      <hr className="border-[#E7E5E4] dark:border-[#20222B] mb-10" />

      <div className="space-y-14">
        {/* Key types */}
        <section>
          <h2
            id="key-types"
            className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-4"
          >
            Key types
          </h2>
          <p className="text-[15px] text-[#737373] leading-[1.65] mb-5">
            Lelu has three kinds of keys. Only one of them requires an account — testing never does.
          </p>
          <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#20222B] text-sm overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="bg-[#F5F5F4] dark:bg-[#0D0E13] text-left">
                  <th className="px-4 py-2.5 font-semibold text-[#0A0A0A] dark:text-white">Key</th>
                  <th className="px-4 py-2.5 font-semibold text-[#0A0A0A] dark:text-white">Account?</th>
                  <th className="px-4 py-2.5 font-semibold text-[#0A0A0A] dark:text-white">Where it works</th>
                </tr>
              </thead>
              <tbody className="text-[#737373]">
                <tr className="border-t border-[#E7E5E4] dark:border-[#20222B]">
                  <td className="px-4 py-3 font-mono text-[13px] text-[#0A0A0A] dark:text-[#E4E4E7]">lelu_local_…</td>
                  <td className="px-4 py-3">No</td>
                  <td className="px-4 py-3">
                    Generated automatically by <code className="font-mono text-[13px]">npx lelu-mcp</code> for
                    the local engine on your machine. Stored in <code className="font-mono text-[13px]">~/.lelu/engine.key</code>; you never handle it.
                  </td>
                </tr>
                <tr className="border-t border-[#E7E5E4] dark:border-[#20222B]">
                  <td className="px-4 py-3 font-mono text-[13px] text-[#0A0A0A] dark:text-[#E4E4E7]">lelu_sk_sandbox_…</td>
                  <td className="px-4 py-3">No</td>
                  <td className="px-4 py-3">Hosted API in demo mode — try decisions without signing up.</td>
                </tr>
                <tr className="border-t border-[#E7E5E4] dark:border-[#20222B]">
                  <td className="px-4 py-3 font-mono text-[13px] text-[#0A0A0A] dark:text-[#E4E4E7]">lelu_sk_…</td>
                  <td className="px-4 py-3">Yes</td>
                  <td className="px-4 py-3">Hosted API with your own policies, revocation, expiry, and audit history.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Get a key */}
        <section>
          <h2
            id="get-a-key"
            className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-4"
          >
            Get a key
          </h2>
          <p className="text-[15px] text-[#737373] leading-[1.65] mb-5">
            Visit{" "}
            <a
              href="/api-key"
              className="text-[#0A0A0A] dark:text-white underline underline-offset-2 hover:opacity-70 transition-opacity"
            >
              lelu-ai.com/api-key
            </a>{" "}
            , create a free account, and click <strong className="text-[#0A0A0A] dark:text-white font-semibold">Create API key</strong>. You get a key in seconds.
          </p>

          <div className="flex gap-3 p-4 rounded-md bg-emerald-50 dark:bg-emerald-900/10 border-l-[3px] border-emerald-500 mb-6">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500 shrink-0 mt-0.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <div className="text-[14px] text-[#0A0A0A] dark:text-[#FAFAFA] leading-relaxed">
              The free tier has fair-use limits while Lelu is in beta. Keys look like{" "}
              <code className="font-mono text-[13px]">lelu_sk_&lt;prefix&gt;_&lt;secret&gt;</code> and are shown
              once at creation — only a hash is stored. Optional expiry can be set when creating a key.
            </div>
          </div>

          <p className="text-[15px] text-[#737373] leading-[1.65] mb-3">
            Copy the key and add it to your <code className="font-mono text-[13px] px-1.5 py-0.5 bg-[#F5F5F4] dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded">.env</code> file:
          </p>

          <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#20222B] text-sm">
            <div className="px-4 py-2 bg-[#F5F5F4] dark:bg-[#0D0E13] border-b border-[#E7E5E4] dark:border-[#20222B]">
              <span className="text-[12px] text-[#737373] font-mono">.env</span>
            </div>
            <pre className="p-4 bg-white dark:bg-[#0A0B10] font-mono text-[13px] text-[#0A0A0A] dark:text-[#E4E4E7] overflow-x-auto">
              LELU_API_KEY=lelu_sk_...
            </pre>
          </div>
        </section>

        {/* Use the key */}
        <section>
          <h2
            id="use-the-key"
            className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-4"
          >
            Use the key
          </h2>

          <p className="text-[15px] text-[#737373] leading-[1.65] mb-5">
            The key authenticates requests to the hosted API. With the SDK, point <code className="font-mono text-[13px] px-1.5 py-0.5 bg-[#F5F5F4] dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded">baseUrl</code> at your engine (self-hosted binary, Docker, or the one lelu-mcp runs for you):
          </p>

          <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#20222B] text-sm mb-6">
            <div className="px-4 py-2 bg-[#F5F5F4] dark:bg-[#0D0E13] border-b border-[#E7E5E4] dark:border-[#20222B]">
              <span className="text-[12px] text-[#737373] font-mono">TypeScript</span>
            </div>
            <pre className="p-4 bg-white dark:bg-[#0A0B10] font-mono text-[13px] text-[#0A0A0A] dark:text-[#E4E4E7] leading-relaxed overflow-x-auto">
{`import { createClient } from "lelu-agent-auth";

const lelu = createClient({
  baseUrl: process.env.LELU_ENGINE_URL ?? "http://localhost:8080",
  apiKey: process.env.LELU_API_KEY,
});`}
            </pre>
          </div>

          <p className="text-[15px] text-[#737373] leading-[1.65] mb-4">
            Or call the hosted API directly using <code className="font-mono text-[13px] px-1.5 py-0.5 bg-[#F5F5F4] dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded">Authorization: Bearer</code>:
          </p>

          <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#20222B] text-sm">
            <div className="px-4 py-2 bg-[#F5F5F4] dark:bg-[#0D0E13] border-b border-[#E7E5E4] dark:border-[#20222B]">
              <span className="text-[12px] text-[#737373] font-mono">bash</span>
            </div>
            <pre className="p-4 bg-white dark:bg-[#0A0B10] font-mono text-[13px] text-[#0A0A0A] dark:text-[#E4E4E7] leading-relaxed overflow-x-auto">
{`curl -X POST https://lelu-ai.com/api/v1/authorize \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $LELU_API_KEY" \\
  -d '{"tool":"refund_payment"}'`}
            </pre>
          </div>
        </section>

        {/* Key properties */}
        <section>
          <h2
            id="key-properties"
            className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-4"
          >
            Key properties
          </h2>

          <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#20222B] text-[13px]">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F5F5F4] dark:bg-[#0D0E13] border-b border-[#E7E5E4] dark:border-[#20222B]">
                  <th className="text-left px-4 py-2.5 text-[#0A0A0A] dark:text-white font-semibold">Property</th>
                  <th className="text-left px-4 py-2.5 text-[#0A0A0A] dark:text-white font-semibold">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E5E4] dark:divide-[#20222B]">
                {[
                  { prop: "Format", val: "lelu_sk_<prefix>_<secret> — shown once, hash-stored" },
                  { prop: "Free tier limit", val: "Fair-use while in beta" },
                  { prop: "Expiration", val: "Optional — set an expiry when creating the key" },
                  { prop: "Auth header", val: "Authorization: Bearer <key>" },
                  { prop: "Env variable", val: "LELU_API_KEY" },
                ].map((r) => (
                  <tr key={r.prop} className="bg-white dark:bg-[#0A0B10]">
                    <td className="px-4 py-2.5 font-mono text-[12px] text-[#0A0A0A] dark:text-[#E4E4E7]">{r.prop}</td>
                    <td className="px-4 py-2.5 text-[#737373]">{r.val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Security */}
        <section>
          <h2
            id="security"
            className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-4"
          >
            Security best practices
          </h2>
          <dl className="space-y-4 text-[14px]">
            {[
              { term: "Never commit keys", desc: "Add .env to .gitignore. Use secrets managers (Vercel env vars, Railway secrets, GitHub Actions secrets) in CI/CD." },
              { term: "One key per service", desc: "Issue a separate key for each agent or service so you can revoke one without affecting others." },
              { term: "Rotate periodically", desc: "Generate a new key from lelu-ai.com/api-key and update the secret before deleting the old one." },
              { term: "Monitor via audit trail", desc: "Every authorization call is logged. Use lelu.listAuditEvents() to detect unexpected usage." },
            ].map((r) => (
              <div key={r.term} className="flex gap-3">
                <code className="font-mono text-[12px] px-2 py-1 bg-[#F5F5F4] dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded shrink-0 h-fit whitespace-nowrap">
                  {r.term}
                </code>
                <span className="text-[#737373] leading-relaxed">{r.desc}</span>
              </div>
            ))}
          </dl>
        </section>

        {/* Troubleshooting */}
        <section>
          <h2
            id="troubleshooting"
            className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-4"
          >
            Troubleshooting
          </h2>
          <div className="space-y-6">
            <div>
              <p className="text-[15px] font-semibold text-[#0A0A0A] dark:text-white mb-2">
                401 unauthorized: invalid or missing API key
              </p>
              <p className="text-[14px] text-[#737373] leading-relaxed">
                Check that <code className="font-mono text-[12px] px-1 py-0.5 bg-[#F5F5F4] dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded">LELU_API_KEY</code> is set in your environment and that your <code className="font-mono text-[12px] px-1 py-0.5 bg-[#F5F5F4] dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded">.env</code> file is loaded (e.g. via <code className="font-mono text-[12px] px-1 py-0.5 bg-[#F5F5F4] dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded">dotenv</code> or Next.js automatic loading). The key starts with <code className="font-mono text-[12px] px-1 py-0.5 bg-[#F5F5F4] dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded">lelu_sk_</code> and is shown only once at creation — make sure you copied it in full.
              </p>
            </div>
            <div>
              <p className="text-[15px] font-semibold text-[#0A0A0A] dark:text-white mb-2">
                429 rate limit exceeded
              </p>
              <p className="text-[14px] text-[#737373] leading-relaxed">
                Free tier allows 500 requests/day. The limit resets at midnight UTC. If you need higher limits, contact us at{" "}
                <a href="mailto:hello@lelu-ai.com" className="text-[#0A0A0A] dark:text-white underline underline-offset-2 hover:opacity-70 transition-opacity">
                  hello@lelu-ai.com
                </a>
                .
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Prev / Next */}
      <div className="flex justify-between items-center pt-10 mt-14 border-t border-[#E7E5E4] dark:border-[#20222B]">
        <a
          href="/docs/installation"
          className="flex items-center gap-2 text-[14px] font-medium text-[#0A0A0A] dark:text-white hover:opacity-70 transition-opacity"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Installation
        </a>
        <a
          href="/docs/concepts/architecture"
          className="flex items-center gap-2 text-[14px] font-medium text-[#0A0A0A] dark:text-white hover:opacity-70 transition-opacity"
        >
          Architecture
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
}
