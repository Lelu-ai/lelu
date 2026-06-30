"use client";

import { useState } from "react";

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CodeBlock({
  tabs,
  code,
}: {
  tabs: string[];
  code: Record<string, string>;
}) {
  const [active, setActive] = useState(tabs[0]);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code[active]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="rounded-lg overflow-hidden border border-[#E7E5E4] dark:border-[#27272A] mb-8 text-sm">
      {/* Tab strip */}
      <div className="flex items-center gap-1 px-3 py-2 bg-[#F5F5F4] dark:bg-[#141416] border-b border-[#E7E5E4] dark:border-[#27272A]">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={[
              "px-2.5 py-1 text-[12px] font-medium rounded transition-colors",
              active === tab
                ? "bg-white dark:bg-[#0B0B0C] text-[#0A0A0A] dark:text-white border border-[#E7E5E4] dark:border-[#27272A]"
                : "text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white",
            ].join(" ")}
          >
            {tab}
          </button>
        ))}
      </div>
      {/* Code area */}
      <div className="relative bg-[#F5F5F4] dark:bg-[#0B0B0C] p-4">
        <pre className="font-mono text-[13px] text-[#0A0A0A] dark:text-[#E4E4E7] leading-relaxed overflow-x-auto">
          {code[active]}
        </pre>
        <button
          onClick={copy}
          className="absolute top-3 right-3 p-1.5 text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white transition-colors"
          aria-label="Copy code"
        >
          {copied ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-500"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <CopyIcon />
          )}
        </button>
      </div>
    </div>
  );
}

function Callout({
  type = "info",
  children,
}: {
  type?: "info" | "warning" | "tip";
  children: React.ReactNode;
}) {
  const styles = {
    info: {
      bg: "bg-[#EFF6FF] dark:bg-blue-900/10",
      border: "border-l-[3px] border-[#3B82F6]",
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[#3B82F6] shrink-0 mt-0.5"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      ),
    },
    warning: {
      bg: "bg-amber-50 dark:bg-amber-900/10",
      border: "border-l-[3px] border-amber-400",
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-amber-500 shrink-0 mt-0.5"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
    tip: {
      bg: "bg-emerald-50 dark:bg-emerald-900/10",
      border: "border-l-[3px] border-emerald-500",
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-emerald-500 shrink-0 mt-0.5"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
    },
  };

  const s = styles[type];
  return (
    <div className={`flex gap-3 p-4 rounded-md ${s.bg} ${s.border} mb-6`}>
      {s.icon}
      <div className="text-[14px] text-[#0A0A0A] dark:text-[#FAFAFA] leading-relaxed">{children}</div>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-5 mb-10">
      <div className="flex-none w-8 h-8 rounded-full border border-[#E7E5E4] dark:border-[#27272A] flex items-center justify-center text-[13px] font-semibold text-[#0A0A0A] dark:text-white shrink-0 mt-0.5">
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-[18px] font-semibold text-[#0A0A0A] dark:text-white mb-2 tracking-tight">
          {title}
        </h3>
        <div className="text-[15px] text-[#737373] leading-[1.65]">{children}</div>
      </div>
    </div>
  );
}

const CLI_TABS = ["Cursor", "Claude Code", "Open Code", "Manual"] as const;
type CliTab = (typeof CLI_TABS)[number];

const CLI_COMMANDS: Record<CliTab, string> = {
  Cursor: "npx lelu-mcp add --cursor",
  "Claude Code": "npx lelu-mcp add --claude",
  "Open Code": "npx lelu-mcp add --open-code",
  Manual: "npx lelu-mcp start --transport stdio",
};

const MANUAL_TABS = ["Claude Code", "Open Code", "JSON"] as const;
type ManualTab = (typeof MANUAL_TABS)[number];

const MANUAL_COMMANDS: Record<ManualTab, string> = {
  "Claude Code": "claude mcp add --transport http lelu http://localhost:3003/sse",
  "Open Code": "open-code mcp add --transport http lelu http://localhost:3003/sse",
  JSON: `{
  "mcpServers": {
    "lelu": {
      "url": "http://localhost:3003/sse"
    }
  }
}`,
};

export default function DocsPage() {
  const [copyMdDone, setCopyMdDone] = useState(false);

  const copyMarkdown = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopyMdDone(true);
    setTimeout(() => setCopyMdDone(false), 1400);
  };

  return (
    <div className="w-full">
      {/* ── Title block ── */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h1
            id="introduction"
            className="text-[34px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white leading-tight"
          >
            Introduction
          </h1>
          <div className="flex items-center gap-4 shrink-0 pt-2">
            <button
              onClick={copyMarkdown}
              className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] uppercase text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white transition-colors"
            >
              {copyMdDone ? "✓" : "📋"} COPY MD
            </button>
            <button className="flex items-center gap-1 text-[11px] font-semibold tracking-[0.06em] uppercase text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white transition-colors">
              OPEN IN
              <svg
                width="9"
                height="9"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>
        </div>
        <p className="text-[15px] text-[#737373] leading-relaxed">
          Learn how to configure Lelu in your project.
        </p>
      </div>

      <hr className="border-[#E7E5E4] dark:border-[#27272A] mb-10" />

      {/* ── What is Lelu ── */}
      <p className="text-[15px] text-[#0A0A0A] dark:text-[#E4E4E7] leading-[1.7] mb-6">
        Lelu is a policy engine for AI-driven systems. It combines Rego-based authorization,
        confidence-aware decisioning, human approval queues, and auditable enforcement so teams can
        ship AI agents without giving up control.
      </p>

      <Callout type="tip">
        Free to start.{" "}
        <a href="/register" className="underline hover:text-[#3B82F6] transition-colors">
          Create an account
        </a>{" "}
        to get an API key and 500 requests per day.
      </Callout>

      {/* ── Features ── */}
      <h2
        id="features"
        className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-4 mt-14"
      >
        Features
      </h2>
      <p className="text-[15px] text-[#737373] leading-relaxed mb-6">
        Lelu includes the core building blocks needed to govern AI actions in production, with simple
        defaults for development and stronger controls for enterprise workloads.
      </p>

      <dl className="space-y-5 mb-14">
        {[
          {
            title: "Framework Agnostic",
            desc: "Works with any AI framework or model provider. Integrate with OpenAI, Anthropic, LangChain, or custom agents without changing your architecture.",
          },
          {
            title: "Confidence-Aware Policies",
            desc: "Author policies that branch on the model's self-reported confidence score, not just binary allow/deny. Low-confidence actions route to human review automatically.",
          },
          {
            title: "Human-in-the-Loop",
            desc: "Automatically queue risky or uncertain operations for human review. The agent pauses and waits for an approval or denial before continuing.",
          },
          {
            title: "Prompt Injection Defense",
            desc: "Detect and block adversarial instructions embedded in user input or tool responses before they can manipulate agent behavior.",
          },
          {
            title: "Observability & Tracing",
            desc: "OpenTelemetry integration with AI agent semantic conventions. Every authorization decision is a traced span with full context.",
          },
          {
            title: "Multi-Agent Coordination",
            desc: "Parent agents delegate to sub-agents with scoped, time-limited permissions. Enforces least-privilege across swarms.",
          },
        ].map((f) => (
          <div key={f.title} className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[#0A0A0A] dark:bg-white mt-[9px] shrink-0" />
            <div>
              <dt className="font-semibold text-[15px] text-[#0A0A0A] dark:text-white mb-1">
                {f.title}
              </dt>
              <dd className="text-[15px] text-[#737373] leading-relaxed">{f.desc}</dd>
            </div>
          </div>
        ))}
      </dl>

      {/* ── Why Lelu ── */}
      <h2
        id="why-lelu"
        className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-4 mt-14"
      >
        Why Lelu?
      </h2>
      <p className="text-[15px] text-[#0A0A0A] dark:text-[#E4E4E7] leading-[1.7] mb-4">
        Traditional authorization systems — RBAC, ABAC — are binary: a user either has permission or
        they don't. But AI agents operate on probabilities. When an agent tries to execute a
        financial trade, delete a database record, or send an email on someone's behalf, you don't
        just want to know <em>if</em> it has permission — you want to know{" "}
        <em>how confident</em> it is.
      </p>
      <p className="text-[15px] text-[#0A0A0A] dark:text-[#E4E4E7] leading-[1.7] mb-10">
        Lelu is the authorization layer purpose-built for this. It sits between your AI agent and
        the world, evaluating every proposed action against your policies and the agent's own
        certainty before letting it proceed.
      </p>

      {/* ── How Lelu Works ── */}
      <h2
        id="how-it-works"
        className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-8 mt-14"
      >
        How Lelu Works
      </h2>

      <Step n={1} title="Confidence-Aware Policies">
        <p>
          Write authorization rules in Rego that branch on the AI's self-reported certainty. A high-confidence
          action is allowed; a borderline one routes to a human. No binary allow/deny.
        </p>
        <div className="mt-4 rounded-md bg-[#F5F5F4] dark:bg-[#141416] border border-[#E7E5E4] dark:border-[#27272A] p-4 font-mono text-[13px] text-[#0A0A0A] dark:text-[#E4E4E7]">
          <div className="mb-1">
            <span className="text-rose-600 dark:text-rose-400">allow</span>{" "}
            <span className="text-[#737373">{"{"}</span>
          </div>
          <div className="pl-4 mb-1">
            input.action == <span className="text-emerald-600 dark:text-emerald-400">"trade"</span>
          </div>
          <div className="pl-4 mb-1">
            input.confidence{" "}
            <span className="text-[#737373]">{">="}</span>{" "}
            <span className="text-amber-600 dark:text-amber-400">0.90</span>
          </div>
          <div className="text-[#737373]">{"}"}</div>
          <div className="mt-3 mb-1">
            <span className="text-rose-600 dark:text-rose-400">require_approval</span>{" "}
            <span className="text-[#737373]">{"{"}</span>
          </div>
          <div className="pl-4 mb-1">
            input.action == <span className="text-emerald-600 dark:text-emerald-400">"trade"</span>
          </div>
          <div className="pl-4 mb-1">
            input.confidence{" "}
            <span className="text-[#737373]">{"<"}</span>{" "}
            <span className="text-amber-600 dark:text-amber-400">0.90</span>
          </div>
          <div className="text-[#737373]">{"}"}</div>
        </div>
      </Step>

      <Step n={2} title="Human-in-the-Loop">
        <p>
          When an action fails the confidence threshold, Lelu enqueues it for human review. The
          agent pauses and polls until an operator approves or denies. This gives teams fine-grained
          control without blocking the happy path.
        </p>
      </Step>

      <Step n={3} title="Immutable Audit Trail">
        <p>
          Every authorization decision — the action requested, the policy matched, the confidence
          score, the human reviewer if any — is recorded as an immutable event. Export to your SIEM
          or query via the Audit API.
        </p>
      </Step>

      {/* ── Architecture ── */}
      <h2
        id="architecture"
        className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-4 mt-14"
      >
        Architecture
      </h2>
      <p className="text-[15px] text-[#737373] leading-relaxed mb-6">
        Lelu runs as a sidecar or standalone service. Your agents make a single{" "}
        <code className="font-mono text-[13px] px-1.5 py-0.5 bg-[#F5F5F4] dark:bg-[#141416] border border-[#E7E5E4] dark:border-[#27272A] rounded">
          POST /v1/agent/authorize
        </code>{" "}
        call before every tool invocation. The engine evaluates your Rego policies — sub-50ms — and
        returns{" "}
        <code className="font-mono text-[13px] px-1.5 py-0.5 bg-[#F5F5F4] dark:bg-[#141416] border border-[#E7E5E4] dark:border-[#27272A] rounded">
          allow
        </code>
        ,{" "}
        <code className="font-mono text-[13px] px-1.5 py-0.5 bg-[#F5F5F4] dark:bg-[#141416] border border-[#E7E5E4] dark:border-[#27272A] rounded">
          deny
        </code>
        , or{" "}
        <code className="font-mono text-[13px] px-1.5 py-0.5 bg-[#F5F5F4] dark:bg-[#141416] border border-[#E7E5E4] dark:border-[#27272A] rounded">
          require_approval
        </code>
        .
      </p>

      <div className="rounded-lg border border-[#E7E5E4] dark:border-[#27272A] overflow-hidden mb-14">
        <div className="bg-[#F5F5F4] dark:bg-[#141416] p-5 space-y-2 text-[13px] font-mono text-[#0A0A0A] dark:text-[#E4E4E7]">
          <div className="flex items-center gap-2">
            <span className="text-[#737373]">AI Agent</span>
            <span className="flex-1 border-t border-dashed border-[#E7E5E4] dark:border-[#27272A]" />
            <span className="text-[#737373]">→</span>
            <span>POST /v1/agent/authorize</span>
            <span className="text-[#737373]">→</span>
            <span>Lelu Engine</span>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/10">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-emerald-700 dark:text-emerald-400 text-[12px]">
                allow — conf ≥ 90%
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              <span className="text-amber-700 dark:text-amber-400 text-[12px]">
                review — conf &lt; 90%
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              <span className="text-red-700 dark:text-red-400 text-[12px]">deny — blocked</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── MCP ── */}
      <h2
        id="mcp"
        className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-4 mt-14"
      >
        Model Context Protocol
      </h2>
      <p className="text-[15px] text-[#0A0A0A] dark:text-[#E4E4E7] leading-[1.7] mb-4">
        Lelu ships a first-party MCP server so you can use it with any AI client that supports the
        Model Context Protocol. Use the CLI to add it in one command, or configure manually.
      </p>

      <Callout type="info">
        The Lelu MCP is powered by{" "}
        <a
          href="https://github.com/modelcontextprotocol/servers"
          className="underline hover:text-[#3B82F6] transition-colors"
        >
          fastmcp
        </a>
        . The official MCP package is <code className="font-mono text-[12px] bg-[#F5F5F4] dark:bg-[#1A1A1C] px-1.5 py-0.5 rounded">lelu-mcp</code> on npm.
      </Callout>

      <h3
        id="cli-options"
        className="text-[17px] font-semibold tracking-[-0.01em] text-[#0A0A0A] dark:text-white mb-3 mt-8"
      >
        CLI options
      </h3>
      <p className="text-[15px] text-[#737373] mb-4">
        Use the Lelu CLI to add the MCP server to your preferred client:
      </p>

      <CodeBlock
        tabs={[...CLI_TABS]}
        code={CLI_COMMANDS}
      />

      <h3
        id="manual-configuration"
        className="text-[17px] font-semibold tracking-[-0.01em] text-[#0A0A0A] dark:text-white mb-3 mt-8"
      >
        Manual configuration
      </h3>
      <p className="text-[15px] text-[#737373] mb-4">
        Alternatively, point any MCP-compatible client at the Lelu SSE endpoint directly:
      </p>

      <CodeBlock
        tabs={[...MANUAL_TABS]}
        code={MANUAL_COMMANDS}
      />

      {/* ── Next steps ── */}
      <h2
        id="next-steps"
        className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-4 mt-14"
      >
        Next steps
      </h2>
      <ul className="space-y-2.5 text-[15px] mb-14">
        {[
          { href: "/api-key", label: "Get your API key", desc: "Free account, 500 requests/day" },
          { href: "/docs/installation", label: "Installation", desc: "Add Lelu to an existing project" },
          { href: "/docs/quickstart", label: "Quickstart", desc: "Authorize your first agent action" },
          { href: "/docs/concepts/architecture", label: "Architecture", desc: "How Lelu works under the hood" },
          { href: "/docs/concepts/api", label: "API reference", desc: "Full REST API documentation" },
        ].map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              className="flex items-baseline gap-2 group"
            >
              <span className="text-[#0A0A0A] dark:text-white font-medium group-hover:underline underline-offset-2">
                {link.label}
              </span>
              <span className="text-[#737373]">—</span>
              <span className="text-[#737373]">{link.desc}</span>
            </a>
          </li>
        ))}
      </ul>

      {/* ── Prev / Next navigation ── */}
      <div className="flex justify-end items-center pt-8 border-t border-[#E7E5E4] dark:border-[#27272A]">
        <a
          href="/docs/installation"
          className="flex items-center gap-2 text-[14px] font-medium text-[#0A0A0A] dark:text-white hover:opacity-70 transition-opacity"
        >
          Installation
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
}
