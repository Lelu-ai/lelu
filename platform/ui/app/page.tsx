import Link from 'next/link';

const pillars = [
  {
    title: "Policy-Driven Decisions",
    text: "Lelu applies Rego policies at action time so every tool call can be evaluated, gated, and audited before hitting your APIs.",
    icon: (
      <svg className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    title: "Human-in-the-Loop",
    text: "High-risk AI actions (like issuing refunds or dropping tables) are automatically paused and routed to human reviewers in a beautiful UI.",
    icon: (
      <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    title: "Tamper-Proof Audit Trail",
    text: "Every allow, deny, and escalation is captured with confidence context, trace IDs, and decision metadata for absolute observability.",
    icon: (
      <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2M9 5a2 2 0 012 2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Multi-Agent Delegation",
    text: "Agents can safely mint short-lived, scoped-down tokens for sub-agents, ensuring the principle of least privilege extends to swarms.",
    icon: (
      <svg className="h-6 w-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  }
];

const features = [
  {
    title: "Behavioral Analytics",
    description: "Track agent reputation, detect anomalies, and monitor behavior patterns in real-time.",
    icon: "📊",
    color: "from-blue-500 to-indigo-500"
  },
  {
    title: "Predictive Analytics",
    description: "ML-powered predictions for confidence scores, human review needs, and policy optimization.",
    icon: "🎯",
    color: "from-purple-500 to-pink-500"
  },
  {
    title: "OpenTelemetry Tracing",
    description: "Full distributed tracing with AI-specific semantic conventions for complete observability.",
    icon: "🔍",
    color: "from-emerald-500 to-teal-500"
  },
  {
    title: "Prompt Injection Detection",
    description: "Automatic detection and blocking of prompt injection attacks to keep your agents secure.",
    icon: "🛡️",
    color: "from-red-500 to-orange-500"
  }
];

const stats = [
  { value: "99.9%", label: "Uptime SLA" },
  { value: "<50ms", label: "P95 Latency" },
  { value: "100%", label: "Audit Coverage" },
  { value: "SOC 2", label: "Compliant" }
];

export default function Home() {
  return (
    <div className="relative min-h-screen bg-white text-black dark:bg-[#000000] dark:text-white overflow-hidden selection:bg-indigo-500/30">

      {/* Dynamic Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-blob" />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/10 blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-2000" />
        <div className="absolute bottom-[-20%] left-[20%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-4000" />
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-24 pb-32">

        {/* Hero Section */}
        <div className="flex flex-col items-center text-center space-y-8 animate-fade-in-up">
          <div className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50/50 px-3 py-1 text-sm text-zinc-600 backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
            <span className="flex h-2 w-2 rounded-full bg-indigo-500 mr-2 animate-pulse"></span>
            Lelu Engine v1.0 is live
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-black to-zinc-600 dark:from-white dark:to-zinc-500 max-w-4xl">
            Authorization & Security <br className="hidden md:block" /> for AI Agents
          </h1>

          <p className="max-w-2xl text-lg md:text-xl text-zinc-600 dark:text-zinc-400">
            Lelu helps companies safely deploy autonomous AI systems. Control what agents can do, route risky actions to humans, and maintain complete audit trails—all in real-time.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4 text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>For development teams building AI agents</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Open source & production-ready</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto pt-4">
            <Link href="/docs/quickstart" className="inline-flex items-center justify-center rounded-full bg-black px-8 py-3.5 text-sm font-medium text-white shadow-lg transition-transform hover:scale-105 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
              Get Started
              <svg className="ml-2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link href="/api-key" className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-3.5 text-sm font-medium text-white shadow-lg transition-transform hover:scale-105 hover:from-indigo-700 hover:to-purple-700">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Get API Key
            </Link>
            <Link href="/docs" className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white/50 px-8 py-3.5 text-sm font-medium text-zinc-900 backdrop-blur-md transition-colors hover:bg-zinc-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">
              Documentation
            </Link>
            <a href="https://github.com/lelu-auth/lelu" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white/50 px-8 py-3.5 text-sm font-medium text-zinc-900 backdrop-blur-md transition-colors hover:bg-zinc-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
              GitHub
            </a>
          </div>
        </div>

        {/* Quick Install Section */}
        <div className="mt-16 flex justify-center w-full opacity-0 animate-[fadeInUp_0.8s_ease-out_0.15s_forwards]">
          <div className="w-full max-w-3xl">
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mb-4">Get Started in 2 Minutes</p>
            
            {/* Primary Install Method - Featured */}
            <div className="mb-6 relative overflow-hidden rounded-2xl border-2 border-indigo-500/50 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-6">
              <div className="absolute top-2 right-2">
                <span className="inline-flex items-center rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-medium text-white">
                  Recommended
                </span>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">One-Command Setup</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                    Install SDK and start all services with Docker automatically. Includes engine, platform, UI, and database.
                  </p>
                  <div className="bg-zinc-900 dark:bg-black rounded-lg border border-zinc-800 dark:border-white/10 overflow-hidden">
                    <div className="px-3 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
                      <span className="text-xs text-zinc-500 font-mono">terminal</span>
                    </div>
                    <pre className="p-3 font-mono text-sm text-zinc-300">
{`npm install @lelu-auth/lelu
npx @lelu-auth/lelu init`}
                    </pre>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm text-indigo-700 dark:text-indigo-300">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 12l2 2 4-4"/>
                      <circle cx="12" cy="12" r="10"/>
                    </svg>
                    <span>Opens browser to http://localhost:3002 when ready</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Alternative Methods */}
            <p className="text-center text-xs text-zinc-500 dark:text-zinc-400 mb-3">Or install SDK only</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white/40 backdrop-blur-xl dark:border-white/10 dark:bg-black/50 hover:border-zinc-300 dark:hover:border-white/20 transition-colors">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">TypeScript</span>
                    <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M0 12v12h24V0H0zm19.341-.956c.61.152 1.074.423 1.501.865.221.236.549.666.575.77.008.03-1.036.73-1.668 1.123-.023.015-.115-.084-.217-.236-.31-.45-.633-.644-1.128-.678-.728-.05-1.196.331-1.192.967a.88.88 0 00.102.45c.16.331.458.53 1.39.934 1.719.74 2.454 1.227 2.911 1.92.51.773.625 2.008.278 2.926-.38.998-1.325 1.676-2.655 1.9-.411.07-1.384.054-1.82-.03-1.007-.193-1.962-.68-2.573-1.311-.244-.252-.708-.894-.676-.935.013-.013.185-.125.382-.248l.717-.448.362-.226.244.354c.334.485.748.79 1.298.956.813.246 1.926.12 2.426-.273a.89.89 0 00.378-.852c-.024-.35-.16-.53-.645-.848-.348-.228-1.116-.58-1.711-.784-1.71-.588-2.446-1.224-2.788-2.408-.096-.333-.108-1.15-.024-1.51.308-1.32 1.37-2.23 2.832-2.426.433-.058 1.443-.024 1.858.063zM13.116 7.945l.004 1.66h-2.802v7.61H8.235v-7.61H5.433v-1.66l.004-.003h7.679z"/></svg>
                  </div>
                  <code className="text-xs font-mono text-zinc-700 dark:text-zinc-300">npm install @lelu-auth/lelu</code>
                </div>
              </div>
              <div className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white/40 backdrop-blur-xl dark:border-white/10 dark:bg-black/50 hover:border-zinc-300 dark:hover:border-white/20 transition-colors">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Python</span>
                    <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14.25.18l.9.2.73.26.59.3.45.32.34.34.25.34.16.33.1.3.04.26.02.2-.01.13V8.5l-.05.63-.13.55-.21.46-.26.38-.3.31-.33.25-.35.19-.35.14-.33.1-.3.07-.26.04-.21.02H8.77l-.69.05-.59.14-.5.22-.41.27-.33.32-.27.35-.2.36-.15.37-.1.35-.07.32-.04.27-.02.21v3.06H3.17l-.21-.03-.28-.07-.32-.12-.35-.18-.36-.26-.36-.36-.35-.46-.32-.59-.28-.73-.21-.88-.14-1.05-.05-1.23.06-1.22.16-1.04.24-.87.32-.71.36-.57.4-.44.42-.33.42-.24.4-.16.36-.1.32-.05.24-.01h.16l.06.01h8.16v-.83H6.18l-.01-2.75-.02-.37.05-.34.11-.31.17-.28.25-.26.31-.23.38-.2.44-.18.51-.15.58-.12.64-.1.71-.06.77-.04.84-.02 1.27.05zm-6.3 1.98l-.23.33-.08.41.08.41.23.34.33.22.41.09.41-.09.33-.22.23-.34.08-.41-.08-.41-.23-.33-.33-.22-.41-.09-.41.09zm13.09 3.95l.28.06.32.12.35.18.36.27.36.35.35.47.32.59.28.73.21.88.14 1.04.05 1.23-.06 1.23-.16 1.04-.24.86-.32.71-.36.57-.4.45-.42.33-.42.24-.4.16-.36.09-.32.05-.24.02-.16-.01h-8.22v.82h5.84l.01 2.76.02.36-.05.34-.11.31-.17.29-.25.25-.31.24-.38.2-.44.17-.51.15-.58.13-.64.09-.71.07-.77.04-.84.01-1.27-.04-1.07-.14-.9-.2-.73-.25-.59-.3-.45-.33-.34-.34-.25-.34-.16-.33-.1-.3-.04-.25-.02-.2.01-.13v-5.34l.05-.64.13-.54.21-.46.26-.38.3-.32.33-.24.35-.2.35-.14.33-.1.3-.06.26-.04.21-.02.13-.01h5.84l.69-.05.59-.14.5-.21.41-.28.33-.32.27-.35.2-.36.15-.36.1-.35.07-.32.04-.28.02-.21V6.07h2.09l.14.01zm-6.47 14.25l-.23.33-.08.41.08.41.23.33.33.23.41.08.41-.08.33-.23.23-.33.08-.41-.08-.41-.23-.33-.33-.23-.41-.08-.41.08z"/></svg>
                  </div>
                  <code className="text-xs font-mono text-zinc-700 dark:text-zinc-300">pip install lelu-agent-auth-sdk</code>
                </div>
              </div>
              <div className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white/40 backdrop-blur-xl dark:border-white/10 dark:bg-black/50 hover:border-zinc-300 dark:hover:border-white/20 transition-colors">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Go</span>
                    <svg className="w-4 h-4 text-cyan-500" fill="currentColor" viewBox="0 0 24 24"><path d="M1.811 10.231c-.047 0-.058-.023-.035-.059l.246-.315c.023-.035.081-.058.128-.058h4.172c.046 0 .058.035.035.07l-.199.303c-.023.036-.082.07-.117.07zM.047 11.306c-.047 0-.059-.023-.035-.058l.245-.316c.023-.035.082-.058.129-.058h5.328c.047 0 .07.035.058.07l-.093.28c-.012.047-.058.07-.105.07zm2.828 1.075c-.047 0-.059-.035-.035-.07l.163-.292c.023-.035.07-.07.117-.07h2.337c.047 0 .07.035.07.082l-.023.28c0 .047-.047.082-.082.082zm12.129-2.36c-.736.187-1.239.327-1.963.514-.176.046-.187.058-.34-.117-.174-.199-.303-.327-.548-.444-.737-.362-1.45-.257-2.115.175-.795.514-1.204 1.274-1.192 2.22.011.935.654 1.706 1.577 1.835.795.105 1.46-.175 1.987-.77.105-.13.198-.27.315-.434H10.47c-.245 0-.304-.152-.222-.35.152-.362.432-.97.596-1.274a.315.315 0 01.292-.187h4.253c-.023.316-.023.631-.07.947a4.983 4.983 0 01-.958 2.29c-.841 1.11-1.94 1.8-3.33 1.986-1.145.152-2.209-.07-3.143-.77-.865-.655-1.356-1.52-1.484-2.595-.152-1.274.222-2.419.993-3.424.83-1.086 1.928-1.776 3.272-2.02 1.098-.2 2.15-.07 3.096.571.62.41 1.063.97 1.356 1.648.07.105.023.164-.117.2m3.868 6.461c-1.064-.024-2.034-.328-2.852-1.029a3.665 3.665 0 01-1.262-2.255c-.21-1.32.152-2.489.947-3.529.853-1.122 1.881-1.706 3.272-1.95 1.192-.21 2.314-.095 3.33.595.923.63 1.496 1.484 1.648 2.605.198 1.578-.257 2.863-1.344 3.962-.771.783-1.718 1.273-2.805 1.495-.315.06-.63.07-.934.106zm2.78-4.72c-.011-.153-.011-.27-.034-.387-.21-1.157-1.274-1.81-2.384-1.554-1.087.245-1.788.935-2.045 2.033-.21.912.234 1.835 1.075 2.21.643.28 1.285.244 1.905-.07.923-.48 1.425-1.228 1.484-2.233z"/></svg>
                  </div>
                  <code className="text-xs font-mono text-zinc-700 dark:text-zinc-300">go get github.com/lelu-auth/lelu</code>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Code/Terminal Showcase */}
        <div className="mt-20 flex justify-center w-full opacity-0 animate-[fadeInUp_0.8s_ease-out_0.2s_forwards]">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-zinc-200 bg-white/40 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-black/50">
            <div className="flex items-center border-b border-zinc-200 px-4 py-3 dark:border-white/10">
              <div className="flex space-x-2">
                <div className="h-3 w-3 rounded-full bg-rose-500/80"></div>
                <div className="h-3 w-3 rounded-full bg-amber-500/80"></div>
                <div className="h-3 w-3 rounded-full bg-emerald-500/80"></div>
              </div>
              <div className="ml-4 text-xs font-medium text-zinc-500">agent.ts</div>
            </div>
            <div className="p-6 overflow-x-auto text-sm">
              <pre className="font-mono leading-relaxed">
                <code className="text-zinc-800 dark:text-zinc-200">
                  <span className="text-purple-600 dark:text-purple-400">import</span> {"{ "}LeluClient{" }"} <span className="text-purple-600 dark:text-purple-400">from</span> <span className="text-emerald-600 dark:text-emerald-400">'@lelu-auth/lelu'</span>;<br />
                  <span className="text-purple-600 dark:text-purple-400">import</span> {"{ "}OpenAI{" }"} <span className="text-purple-600 dark:text-purple-400">from</span> <span className="text-emerald-600 dark:text-emerald-400">'openai'</span>;<br /><br />
                  <span className="text-zinc-500 dark:text-zinc-500">// Initialize Lelu client</span><br />
                  <span className="text-blue-600 dark:text-blue-400">const</span> lelu = <span className="text-blue-600 dark:text-blue-400">new</span> LeluClient({"{"}<br />
                  {"  "}baseUrl: <span className="text-emerald-600 dark:text-emerald-400">'http://localhost:8080'</span><br />
                  {"}"});<br /><br />
                  <span className="text-zinc-500 dark:text-zinc-500">// Secure your agent actions</span><br />
                  <span className="text-blue-600 dark:text-blue-400">const</span> decision = <span className="text-blue-600 dark:text-blue-400">await</span> lelu.agentAuthorize({"{"}<br />
                  {"  "}actor: <span className="text-emerald-600 dark:text-emerald-400">"billing-agent"</span>,<br />
                  {"  "}action: <span className="text-emerald-600 dark:text-emerald-400">"refund:process"</span>,<br />
                  {"  "}resource: {"{ "}orderId: <span className="text-emerald-600 dark:text-emerald-400">"12345"</span>{" }"},<br />
                  {"  "}context: {"{ "}confidence: <span className="text-amber-600 dark:text-amber-400">0.85</span>{" }"}<br />
                  {"}"});<br /><br />
                  <span className="text-zinc-500 dark:text-zinc-500">// If confidence {'<'} threshold, automatically routes to human review</span>
                </code>
              </pre>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="mt-24 opacity-0 animate-[fadeInUp_0.8s_ease-out_0.3s_forwards]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, idx) => (
              <div key={idx} className="text-center">
                <div className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-indigo-400 dark:to-purple-500">
                  {stat.value}
                </div>
                <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bento Grid */}
        <div className="mt-32">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Security infrastructure for your agents.</h2>
            <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">A comprehensive suite to monitor, control, and audit autonomous workflows.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pillars.map((pillar, idx) => (
              <div key={idx} className="group relative overflow-hidden rounded-3xl border border-zinc-200 bg-white/50 p-8 hover:bg-white/80 transition-colors backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-white/10">
                  {pillar.icon}
                </div>
                <h3 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-white">{pillar.title}</h3>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{pillar.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Advanced Features Section */}
        <div className="mt-32">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Advanced Features</h2>
            <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">AI-powered analytics and monitoring for production deployments.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => (
              <div key={idx} className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white/50 p-6 hover:shadow-xl transition-all backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10">
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${feature.color} opacity-10 blur-3xl group-hover:opacity-20 transition-opacity`}></div>
                <div className="relative">
                  <div className="text-4xl mb-4">{feature.icon}</div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-32 text-center">
          <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-12 dark:border-white/10 dark:from-indigo-950/50 dark:to-purple-950/50">
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Ready to secure your AI agents?
              </h2>
              <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-8 max-w-2xl mx-auto">
                Get started with Lelu in minutes. Deploy locally with Docker or use our cloud-hosted solution.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/docs/quickstart" className="inline-flex items-center justify-center rounded-full bg-black px-8 py-3.5 text-sm font-medium text-white shadow-lg transition-transform hover:scale-105 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
                  Start Building
                  <svg className="ml-2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link href="/docs" className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white/50 px-8 py-3.5 text-sm font-medium text-zinc-900 backdrop-blur-md transition-colors hover:bg-zinc-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">
                  View Documentation
                </Link>
              </div>
            </div>
            <div className="absolute top-0 left-0 w-full h-full opacity-30">
              <div className="absolute top-[-50%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-500/20 blur-[100px]" />
              <div className="absolute bottom-[-50%] right-[-10%] w-[60%] h-[60%] rounded-full bg-purple-500/20 blur-[100px]" />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
