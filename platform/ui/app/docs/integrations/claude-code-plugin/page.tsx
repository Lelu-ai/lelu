export default function DocsClaudeCodePlugin() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 text-sm font-medium mb-6">
          Integrations
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">
          Claude Code Plugin
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          The <a href="/docs/integrations/mcp" className="underline hover:text-zinc-900 dark:hover:text-white">MCP integration</a>{" "}
          gives your agent a tool it can <em>choose</em> to call. The Claude Code plugin goes
          further: it hooks directly into every <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">Bash</code>,{" "}
          <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">Edit</code>, and{" "}
          <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">Write</code> call
          via Claude Code&apos;s own <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">PreToolUse</code> hook,
          so protection doesn&apos;t depend on the agent remembering to ask.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Install</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-4">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">Terminal</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`git clone https://github.com/lelu-ai/lelu.git && cd lelu
claude plugin marketplace add .
claude plugin install lelu@lelu
./plugin-claude-code/install.sh`}</pre>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400">
            <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">install.sh</code>{" "}
            builds from source if you have Go, or downloads a prebuilt binary from{" "}
            <a href="https://github.com/lelu-ai/lelu/releases" className="underline hover:text-zinc-900 dark:hover:text-white">GitHub Releases</a>{" "}
            if you don&apos;t. No account, no cloud dependency — everything runs and stays on your machine.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">What it catches</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Expansion-aware analysis resolves <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">~</code>,{" "}
            <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">$VARS</code>, and globs
            before matching policy — so it catches destructive commands a regex on the raw text
            misses (reversed flags, long-form flags, separated flags), while staying silent on
            routine work like <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">rm -rf node_modules</code>.
            A real, reproducible comparison against hookify&apos;s own documented example rule:
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">benchmarks/report.md</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`                        hookify    Lelu
Destructive caught        7/10     10/10
False positives (benign)   4/4      0/4`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Shadow mode by default</h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            Nothing is blocked on install. Every decision is still logged to{" "}
            <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">~/.lelu/claude-plugin/ledger.jsonl</code>{" "}
            regardless of mode — run <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">/lelu:lelu-status</code>{" "}
            inside Claude Code to see what it would have done, and{" "}
            <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">/lelu:lelu-enforce</code>{" "}
            when you&apos;re ready to turn on real blocking.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Also included</h2>
          <ul className="space-y-3 text-zinc-600 dark:text-zinc-400">
            <li>
              <strong className="text-zinc-900 dark:text-white">Retry-storm detection</strong> — the same
              action repeated too many times too fast in one session gets flagged instead of
              silently allowed forever.
            </li>
            <li>
              <strong className="text-zinc-900 dark:text-white">Session wall-clock budget</strong> — a
              session that&apos;s been running for hours gets a one-time review prompt, the same
              failure mode behind real &quot;$6,000 burned overnight&quot; agent incidents.
            </li>
            <li>
              <strong className="text-zinc-900 dark:text-white">hookify rule import</strong> — existing{" "}
              <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">.claude/hookify.*.local.md</code>{" "}
              rules keep working with zero edits, upgraded from a silent notice to an actual pause
              for review.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Commands</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">Inside Claude Code</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`/lelu:lelu-status    Current mode + a summary of recent decisions
/lelu:lelu-enforce   Start actually blocking deny/ask decisions
/lelu:lelu-shadow    Back to observe-only
/lelu <rule>         Turn a plain-English rule into a policy entry
                     e.g. /lelu never touch the prod database`}</pre>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a href="/docs/integrations/mcp" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Previous: MCP
        </a>
        <a href="/docs/integrations/vercel-ai" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Next: Vercel AI SDK
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </a>
      </div>
    </div>
  );
}
