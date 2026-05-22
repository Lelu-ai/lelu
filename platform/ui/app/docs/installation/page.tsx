"use client";

import { useState } from "react";

export default function DocsInstallation() {
  const [pkgTab, setPkgTab] = useState<"npm" | "pnpm" | "yarn" | "bun">("npm");
  const [copied, setCopied] = useState<string | null>(null);

  const pkgCmd: Record<typeof pkgTab, string> = {
    npm: "npm install lelu-agent-auth",
    pnpm: "pnpm add lelu-agent-auth",
    yarn: "yarn add lelu-agent-auth",
    bun: "bun add lelu-agent-auth",
  };

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const CopyBtn = ({ text, id }: { text: string; id: string }) => (
    <button
      onClick={() => copy(text, id)}
      className="absolute top-3 right-3 p-1.5 rounded bg-[#F5F5F4] dark:bg-[#222224] border border-[#E7E5E4] dark:border-[#27272A] hover:bg-[#E7E5E4] dark:hover:bg-[#27272A] transition-colors"
      title="Copy"
    >
      {copied === id ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#737373]">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );

  return (
    <div className="w-full">
      {/* Title block */}
      <div className="mb-8">
        <h1
          id="installation"
          className="text-[34px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white leading-tight mb-3"
        >
          Installation
        </h1>
        <p className="text-[15px] text-[#737373] leading-relaxed">
          Install the SDK, get an API key, and start authorizing agent actions — no Docker, no server setup.
        </p>
      </div>

      <hr className="border-[#E7E5E4] dark:border-[#27272A] mb-10" />

      <div className="space-y-14">
        {/* Step 1 — Install */}
        <section>
          <div className="flex gap-5 mb-5">
            <div className="flex-none w-8 h-8 rounded-full border border-[#E7E5E4] dark:border-[#27272A] flex items-center justify-center text-[13px] font-semibold text-[#0A0A0A] dark:text-white shrink-0 mt-0.5">
              1
            </div>
            <h2
              id="install-sdk"
              className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white pt-0.5"
            >
              Install the SDK
            </h2>
          </div>
          <div className="ml-[52px]">
            <p className="text-[15px] text-[#737373] leading-[1.65] mb-4">
              Add <code className="font-mono text-[13px] px-1.5 py-0.5 bg-[#F5F5F4] dark:bg-[#141416] border border-[#E7E5E4] dark:border-[#27272A] rounded">lelu-agent-auth</code> to your project:
            </p>

            {/* Tabbed package manager */}
            <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#27272A] text-sm mb-4 relative">
              <div className="flex items-center gap-1 px-3 py-1.5 bg-[#F5F5F4] dark:bg-[#141416] border-b border-[#E7E5E4] dark:border-[#27272A]">
                {(["npm", "pnpm", "yarn", "bun"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setPkgTab(t)}
                    className={`px-2.5 py-1 text-[12px] rounded transition-colors ${
                      pkgTab === t
                        ? "bg-white dark:bg-[#0B0B0C] text-[#0A0A0A] dark:text-white font-medium border border-[#E7E5E4] dark:border-[#27272A]"
                        : "text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <pre className="p-4 bg-white dark:bg-[#0B0B0C] font-mono text-[13px] text-[#0A0A0A] dark:text-[#E4E4E7] overflow-x-auto">
                {pkgCmd[pkgTab]}
              </pre>
              <CopyBtn text={pkgCmd[pkgTab]} id="pkg" />
            </div>

            <p className="text-[14px] text-[#737373]">
              Supports Node.js 18+. TypeScript types are included — no separate <code className="font-mono text-[12px] px-1 py-0.5 bg-[#F5F5F4] dark:bg-[#141416] border border-[#E7E5E4] dark:border-[#27272A] rounded">@types</code> package needed.
            </p>
          </div>
        </section>

        {/* Step 2 — API key */}
        <section>
          <div className="flex gap-5 mb-5">
            <div className="flex-none w-8 h-8 rounded-full border border-[#E7E5E4] dark:border-[#27272A] flex items-center justify-center text-[13px] font-semibold text-[#0A0A0A] dark:text-white shrink-0 mt-0.5">
              2
            </div>
            <h2
              id="get-api-key"
              className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white pt-0.5"
            >
              Get an API key
            </h2>
          </div>
          <div className="ml-[52px]">
            <p className="text-[15px] text-[#737373] leading-[1.65] mb-5">
              Visit{" "}
              <a
                href="/api-key"
                className="text-[#0A0A0A] dark:text-white underline underline-offset-2 hover:opacity-70 transition-opacity"
              >
                lelu-ai.com/api-key
              </a>{" "}
              and click <strong className="text-[#0A0A0A] dark:text-white font-semibold">Generate Key</strong>. No signup, no email — instant anonymous key with 500 requests/day free.
            </p>

            <p className="text-[15px] text-[#737373] leading-[1.65] mb-4">
              Add it to your <code className="font-mono text-[13px] px-1.5 py-0.5 bg-[#F5F5F4] dark:bg-[#141416] border border-[#E7E5E4] dark:border-[#27272A] rounded">.env</code> file:
            </p>

            <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#27272A] text-sm mb-5 relative">
              <div className="px-4 py-2 bg-[#F5F5F4] dark:bg-[#141416] border-b border-[#E7E5E4] dark:border-[#27272A]">
                <span className="text-[12px] text-[#737373] font-mono">.env</span>
              </div>
              <pre className="p-4 bg-white dark:bg-[#0B0B0C] font-mono text-[13px] text-[#0A0A0A] dark:text-[#E4E4E7] overflow-x-auto">
                LELU_API_KEY=your_key_here
              </pre>
              <CopyBtn text="LELU_API_KEY=your_key_here" id="env" />
            </div>

            <div className="flex gap-3 p-4 rounded-md bg-amber-50 dark:bg-amber-900/10 border-l-[3px] border-amber-500">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 shrink-0 mt-0.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-[14px] text-[#0A0A0A] dark:text-[#FAFAFA] leading-relaxed">
                Never commit your API key to version control. Add <code className="font-mono text-[12px] px-1 py-0.5 bg-[#F5F5F4] dark:bg-[#141416] border border-[#E7E5E4] dark:border-[#27272A] rounded">.env</code> to <code className="font-mono text-[12px] px-1 py-0.5 bg-[#F5F5F4] dark:bg-[#141416] border border-[#E7E5E4] dark:border-[#27272A] rounded">.gitignore</code>.
              </p>
            </div>
          </div>
        </section>

        {/* Step 3 — Configure client */}
        <section>
          <div className="flex gap-5 mb-5">
            <div className="flex-none w-8 h-8 rounded-full border border-[#E7E5E4] dark:border-[#27272A] flex items-center justify-center text-[13px] font-semibold text-[#0A0A0A] dark:text-white shrink-0 mt-0.5">
              3
            </div>
            <h2
              id="configure-client"
              className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white pt-0.5"
            >
              Configure the client
            </h2>
          </div>
          <div className="ml-[52px]">
            <p className="text-[15px] text-[#737373] leading-[1.65] mb-4">
              Create a shared client instance and import it wherever you need to authorize actions:
            </p>

            <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#27272A] text-sm mb-5 relative">
              <div className="px-4 py-2 bg-[#F5F5F4] dark:bg-[#141416] border-b border-[#E7E5E4] dark:border-[#27272A]">
                <span className="text-[12px] text-[#737373] font-mono">lib/lelu.ts</span>
              </div>
              <pre className="p-4 bg-white dark:bg-[#0B0B0C] font-mono text-[13px] text-[#0A0A0A] dark:text-[#E4E4E7] leading-relaxed overflow-x-auto">
{`import { createClient } from "lelu-agent-auth";

export const lelu = createClient({
  apiKey: process.env.LELU_API_KEY,
});`}
              </pre>
              <CopyBtn text={`import { createClient } from "lelu-agent-auth";\n\nexport const lelu = createClient({\n  apiKey: process.env.LELU_API_KEY,\n});`} id="client" />
            </div>

            <p className="text-[15px] text-[#737373] leading-[1.65] mb-4">
              That&apos;s all the configuration needed. The SDK routes to the live cloud engine automatically when an API key is present.
            </p>

            <p className="text-[15px] text-[#737373] leading-[1.65] mb-4">
              Then use it anywhere in your app:
            </p>

            <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#27272A] text-sm relative">
              <div className="px-4 py-2 bg-[#F5F5F4] dark:bg-[#141416] border-b border-[#E7E5E4] dark:border-[#27272A]">
                <span className="text-[12px] text-[#737373] font-mono">TypeScript</span>
              </div>
              <pre className="p-4 bg-white dark:bg-[#0B0B0C] font-mono text-[13px] text-[#0A0A0A] dark:text-[#E4E4E7] leading-relaxed overflow-x-auto">
{`import { lelu } from "@/lib/lelu";

const decision = await lelu.agentAuthorize({
  actor: "billing-agent",
  action: "refund:process",
  resource: { orderId: "ord_123" },
  context: { confidence: 0.85 },
});

if (decision.allowed) {
  // proceed
} else if (decision.requiresHumanReview) {
  // queued for human approval
} else {
  throw new Error(\`Denied: \${decision.reason}\`);
}`}
              </pre>
              <CopyBtn text={`import { lelu } from "@/lib/lelu";\n\nconst decision = await lelu.agentAuthorize({\n  actor: "billing-agent",\n  action: "refund:process",\n  resource: { orderId: "ord_123" },\n  context: { confidence: 0.85 },\n});\n\nif (decision.allowed) {\n  // proceed\n} else if (decision.requiresHumanReview) {\n  // queued for human approval\n} else {\n  throw new Error(\`Denied: \${decision.reason}\`);\n}`} id="usage" />
            </div>
          </div>
        </section>

        {/* Step 4 — Done */}
        <section>
          <div className="flex gap-5 mb-5">
            <div className="flex-none w-8 h-8 rounded-full border border-[#E7E5E4] dark:border-[#27272A] flex items-center justify-center text-[13px] font-semibold text-[#0A0A0A] dark:text-white shrink-0 mt-0.5">
              4
            </div>
            <h2
              id="done"
              className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white pt-0.5"
            >
              Done
            </h2>
          </div>
          <div className="ml-[52px]">
            <div className="flex gap-3 p-4 rounded-md bg-emerald-50 dark:bg-emerald-900/10 border-l-[3px] border-emerald-500 mb-6">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500 shrink-0 mt-0.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <p className="text-[14px] text-[#0A0A0A] dark:text-[#FAFAFA] leading-relaxed">
                Your agent is connected to the Lelu cloud engine. No Docker, no local server, no infrastructure to manage.
              </p>
            </div>

            <p className="text-[15px] text-[#737373] leading-[1.65] mb-4">Where to go next:</p>
            <ul className="space-y-2 text-[14px]">
              {[
                { href: "/docs/quickstart", label: "Quickstart — authorize your first action →" },
                { href: "/docs/integrations/vercel-ai", label: "Vercel AI SDK integration →" },
                { href: "/docs/integrations/langchain", label: "LangChain integration →" },
                { href: "/docs/policies", label: "Write authorization policies →" },
              ].map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="text-[#0A0A0A] dark:text-white font-medium hover:underline underline-offset-2"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Self-hosting (advanced) */}
        <section>
          <div className="flex gap-5 mb-5">
            <div className="flex-none w-8 h-8 rounded-full border border-[#E7E5E4] dark:border-[#27272A] flex items-center justify-center shrink-0 mt-0.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#737373]">
                <path d="M20 7h-9" />
                <path d="M14 17H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h9" />
                <path d="M15 7v10" />
                <path d="M20 7v10a2 2 0 0 1-2 2h-2" />
              </svg>
            </div>
            <h2
              id="self-hosting"
              className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white pt-0.5"
            >
              Self-hosting (advanced)
            </h2>
          </div>
          <div className="ml-[52px]">
            <p className="text-[15px] text-[#737373] leading-[1.65] mb-4">
              If you need to run the engine on your own infrastructure, pass a <code className="font-mono text-[13px] px-1.5 py-0.5 bg-[#F5F5F4] dark:bg-[#141416] border border-[#E7E5E4] dark:border-[#27272A] rounded">baseUrl</code> to the client or set the <code className="font-mono text-[13px] px-1.5 py-0.5 bg-[#F5F5F4] dark:bg-[#141416] border border-[#E7E5E4] dark:border-[#27272A] rounded">LELU_BASE_URL</code> environment variable:
            </p>

            <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#27272A] text-sm mb-5 relative">
              <div className="px-4 py-2 bg-[#F5F5F4] dark:bg-[#141416] border-b border-[#E7E5E4] dark:border-[#27272A]">
                <span className="text-[12px] text-[#737373] font-mono">TypeScript</span>
              </div>
              <pre className="p-4 bg-white dark:bg-[#0B0B0C] font-mono text-[13px] text-[#0A0A0A] dark:text-[#E4E4E7] leading-relaxed overflow-x-auto">
{`const lelu = createClient({
  baseUrl: "https://your-engine.example.com",
  apiKey: process.env.LELU_API_KEY,
});`}
              </pre>
              <CopyBtn text={`const lelu = createClient({\n  baseUrl: "https://your-engine.example.com",\n  apiKey: process.env.LELU_API_KEY,\n});`} id="selfhost" />
            </div>

            <p className="text-[15px] text-[#737373] leading-[1.65] mb-4">
              Or without any code change:
            </p>

            <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#27272A] text-sm mb-5 relative">
              <div className="px-4 py-2 bg-[#F5F5F4] dark:bg-[#141416] border-b border-[#E7E5E4] dark:border-[#27272A]">
                <span className="text-[12px] text-[#737373] font-mono">.env</span>
              </div>
              <pre className="p-4 bg-white dark:bg-[#0B0B0C] font-mono text-[13px] text-[#0A0A0A] dark:text-[#E4E4E7] overflow-x-auto">
{`LELU_BASE_URL=https://your-engine.example.com
LELU_API_KEY=your_key_here`}
              </pre>
              <CopyBtn text={`LELU_BASE_URL=https://your-engine.example.com\nLELU_API_KEY=your_key_here`} id="selfhost-env" />
            </div>

            <p className="text-[15px] text-[#737373] leading-[1.65] mb-4">
              To run the engine locally with Docker:
            </p>

            <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#27272A] text-sm relative">
              <div className="px-4 py-2 bg-[#F5F5F4] dark:bg-[#141416] border-b border-[#E7E5E4] dark:border-[#27272A]">
                <span className="text-[12px] text-[#737373] font-mono">terminal</span>
              </div>
              <pre className="p-4 bg-white dark:bg-[#0B0B0C] font-mono text-[13px] text-[#0A0A0A] dark:text-[#E4E4E7] overflow-x-auto">
{`git clone https://github.com/lelu-auth/lelu.git
cd lelu
docker-compose up -d`}
              </pre>
              <CopyBtn text={`git clone https://github.com/lelu-auth/lelu.git\ncd lelu\ndocker-compose up -d`} id="docker" />
            </div>

            <p className="text-[15px] text-[#737373] leading-[1.65] mt-4">
              See the{" "}
              <a
                href="/docs/guides/production"
                className="text-[#0A0A0A] dark:text-white underline underline-offset-2 hover:opacity-70 transition-opacity"
              >
                production self-hosting guide
              </a>{" "}
              for Docker Compose and Kubernetes manifests.
            </p>
          </div>
        </section>

        {/* URL resolution table */}
        <section>
          <div className="flex gap-5 mb-5">
            <div className="flex-none w-8 h-8 rounded-full border border-[#E7E5E4] dark:border-[#27272A] flex items-center justify-center shrink-0 mt-0.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#737373]">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
            <h2
              id="url-resolution"
              className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white pt-0.5"
            >
              How URL resolution works
            </h2>
          </div>
          <div className="ml-[52px]">
            <p className="text-[15px] text-[#737373] leading-[1.65] mb-4">
              The SDK picks the engine URL automatically:
            </p>
            <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#27272A] text-[13px]">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F5F5F4] dark:bg-[#141416] border-b border-[#E7E5E4] dark:border-[#27272A]">
                    <th className="text-left px-4 py-2.5 text-[#0A0A0A] dark:text-white font-semibold">Situation</th>
                    <th className="text-left px-4 py-2.5 text-[#0A0A0A] dark:text-white font-semibold">Engine used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E5E4] dark:divide-[#27272A]">
                  {[
                    { sit: "apiKey provided, no baseUrl", eng: "Lelu cloud (GCP)" },
                    { sit: "LELU_BASE_URL env var set", eng: "That URL" },
                    { sit: "baseUrl passed to createClient", eng: "That URL" },
                    { sit: "No apiKey, no env var, no baseUrl", eng: "http://localhost:8080 (self-hosted dev)" },
                  ].map((row) => (
                    <tr key={row.sit} className="bg-white dark:bg-[#0B0B0C]">
                      <td className="px-4 py-2.5 font-mono text-[12px] text-[#0A0A0A] dark:text-[#E4E4E7]">{row.sit}</td>
                      <td className="px-4 py-2.5 text-[#737373]">{row.eng}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {/* Prev / Next */}
      <div className="flex justify-between items-center pt-10 mt-14 border-t border-[#E7E5E4] dark:border-[#27272A]">
        <a
          href="/docs/quickstart"
          className="flex items-center gap-2 text-[14px] font-medium text-[#0A0A0A] dark:text-white hover:opacity-70 transition-opacity"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Quickstart
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
