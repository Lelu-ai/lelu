export default function Home() {
  return (
    <div className="flex flex-col items-center px-6 py-12 md:py-20">
      {/* Hero Section */}
      <div className="max-w-7xl w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center min-h-[calc(100vh-200px)]">
          
          {/* Left Side - Text Content */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-sm text-zinc-600 dark:text-zinc-300">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Runtime Authorization for AI Agents
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-zinc-900 dark:text-white leading-[1.1]">
              Prevent risky agent actions before they execute.
            </h1>
            
            <p className="text-lg md:text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xl">
              Lelu enforces policy at tool-call time using confidence-aware decisions, human review queues, and audit-grade traces mapped to every action.
            </p>

            <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-500">
              <code className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono">
                npm i @lelu-auth/lelu
              </code>
              <span>or</span>
              <code className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono">
                go get github.com/lelu-auth/lelu/sdk/go
              </code>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-4">
              <a 
                href="/docs" 
                className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-black dark:bg-white text-white dark:text-black font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all hover:scale-105"
              >
                GET STARTED
              </a>
              <a 
                href="https://github.com/lelu-auth/lelu" 
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all border border-zinc-200 dark:border-zinc-800"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                GitHub
              </a>
            </div>
          </div>

          {/* Right Side - Code Example */}
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 dark:from-blue-500/10 dark:to-purple-500/10 rounded-3xl blur-2xl"></div>
            <div className="relative bg-zinc-900 dark:bg-black rounded-2xl border border-zinc-800 dark:border-zinc-800 overflow-hidden shadow-2xl">
              {/* Terminal Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-zinc-950 dark:bg-zinc-950 border-b border-zinc-800">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">agent-guard.ts</span>
                  <button className="p-1 hover:bg-zinc-800 rounded">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Code Content */}
              <div className="p-6 font-mono text-sm overflow-x-auto">
                <pre className="text-zinc-300">
                  <code>
<span className="text-purple-400">import</span> {"{"} <span className="text-blue-300">LeluClient</span> {"}"} <span className="text-purple-400">from</span> <span className="text-orange-300">"@lelu-auth/lelu"</span>;

<span className="text-purple-400">const</span> <span className="text-blue-300">decision</span> = <span className="text-purple-400">await</span> <span className="text-yellow-300">client</span>.<span className="text-blue-300">agentAuthorize</span>({"{"}
  <span className="text-blue-300">actor</span>: <span className="text-orange-300">"invoice_bot"</span>,
  <span className="text-blue-300">action</span>: <span className="text-orange-300">"approve_refunds"</span>,
  <span className="text-blue-300">confidence_signal</span>: {"{"}
    <span className="text-blue-300">provider</span>: <span className="text-orange-300">"openai"</span>,
    <span className="text-blue-300">token_logprobs</span>: [<span className="text-green-400">-0.04</span>, <span className="text-green-400">-0.05</span>, <span className="text-green-400">-0.03</span>],
  {"}"},
{"}"})

<span className="text-purple-400">if</span> (<span className="text-blue-300">decision</span>.<span className="text-blue-300">requires_human_review</span>) {"{"}
  <span className="text-yellow-300">queueForApproval</span>()
{"}"}
                  </code>
                </pre>
              </div>

              {/* Bottom Action */}
              <div className="px-6 py-4 bg-zinc-950 dark:bg-zinc-950 border-t border-zinc-800 flex items-center justify-between">
                <span className="text-xs text-zinc-500">Authorize every tool call with policy + confidence</span>
                <a href="/docs" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  API Docs
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl w-full mt-32 space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white">
            Why Teams Choose Lelu
          </h2>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Lelu combines enforcement, human oversight, and evidence generation in one runtime control plane for agentic workflows.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Feature 1 */}
          <div className="group relative bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600 dark:text-blue-400">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
              Confidence-Aware Enforcement
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
              Block, downgrade, or route actions to review based on extracted model confidence and policy thresholds.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="group relative bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-500/10 flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-600 dark:text-purple-400">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
              Human-in-the-Loop Queue
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
              Risky actions automatically pause for human approval with auditable resolution history.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="group relative bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-500/10 flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600 dark:text-green-400">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
              Audit-Grade Traceability
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
              Every authorization decision is linked to actor, action, reason, confidence, and timestamp.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="group relative bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
            <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-600 dark:text-orange-400">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
              Shadow Mode Onboarding
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
              Observe policy impact safely before enforce mode with would-have deny/review metrics.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="group relative bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
            <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600 dark:text-red-400">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
              Policy Replay Simulator
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
              Replay historical traces against proposed policies and quantify blast radius before rollout.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="group relative bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
            <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-500/10 flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-600 dark:text-yellow-400">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
              MCP + SDK Integrations
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
              Integrate quickly across Go, TypeScript, Python, and MCP tool-call workflows.
            </p>
          </div>

        </div>
      </div>

      {/* Integrations Section */}
      <div className="max-w-7xl w-full mt-32 space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white">
            Operational Integrations
          </h2>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Ship faster with opinionated integrations for agent frameworks and incident workflows.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { name: "LangChain", icon: "??" },
            { name: "LangGraph", icon: "???" },
            { name: "AutoGPT", icon: "??" },
            { name: "MCP", icon: "??" },
            { name: "FastAPI", icon: "?" },
            { name: "Express", icon: "??" },
            { name: "React", icon: "??" },
            { name: "Go SDK", icon: "??" },
            { name: "TypeScript SDK", icon: "??" },
            { name: "Python SDK", icon: "??" },
            { name: "Datadog", icon: "??" },
            { name: "Splunk", icon: "??" },
            { name: "PagerDuty", icon: "??" },
            { name: "Jira", icon: "??" },
            { name: "Postgres", icon: "??" },
            { name: "Redis", icon: "??" },
            { name: "Helm", icon: "?" },
            { name: "Docker", icon: "??" },
          ].map((provider) => (
            <div
              key={provider.name}
              className="flex flex-col items-center justify-center gap-3 p-6 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group"
            >
              <span className="text-3xl group-hover:scale-110 transition-transform">{provider.icon}</span>
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{provider.name}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
