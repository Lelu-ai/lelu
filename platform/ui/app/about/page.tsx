import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Lelu - AI Agent Authorization Platform',
  description: 'Lelu is an authorization and security platform for AI agents. We help companies safely deploy autonomous AI systems with real-time access control, human oversight, and complete audit trails.',
};

export default function AboutPage() {
  return (
    <div className="relative min-h-screen bg-white text-black dark:bg-[#000000] dark:text-white">
      <div className="mx-auto max-w-5xl px-6 py-24">
        
        {/* Hero Section - Clear & Concise */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            About Lelu AI
          </h1>
          <p className="text-2xl text-zinc-900 dark:text-zinc-100 leading-relaxed max-w-3xl font-medium mb-4">
            We are building an authorization and security platform for AI agents.
          </p>
          <p className="text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-3xl">
            Lelu helps companies safely deploy autonomous AI systems by providing real-time access control, human oversight, and complete audit trails.
          </p>
        </div>

        {/* Quick Facts Box - What Google Wants to See */}
        <div className="mb-16 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 p-8">
          <h2 className="text-2xl font-bold mb-6 text-indigo-900 dark:text-indigo-100">Company Overview</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-zinc-800 dark:text-zinc-200">
            <div>
              <div className="font-semibold text-indigo-700 dark:text-indigo-300 mb-2">Company</div>
              <div className="text-lg">Lelu AI</div>
            </div>
            
            <div>
              <div className="font-semibold text-indigo-700 dark:text-indigo-300 mb-2">Founder</div>
              <div className="text-lg">Abenezer Getachew</div>
            </div>
            
            <div>
              <div className="font-semibold text-indigo-700 dark:text-indigo-300 mb-2">Product</div>
              <div className="text-lg">Authorization Engine for AI Agents</div>
            </div>
            
            <div>
              <div className="font-semibold text-indigo-700 dark:text-indigo-300 mb-2">Status</div>
              <div className="text-lg">Production-ready (v1.0)</div>
            </div>
            
            <div>
              <div className="font-semibold text-indigo-700 dark:text-indigo-300 mb-2">SDKs Available</div>
              <div className="text-lg">TypeScript, Python, Go</div>
            </div>
            
            <div>
              <div className="font-semibold text-indigo-700 dark:text-indigo-300 mb-2">License</div>
              <div className="text-lg">Open Source (MIT)</div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-indigo-200 dark:border-indigo-800">
            <div className="font-semibold text-indigo-700 dark:text-indigo-300 mb-3">Product Links</div>
            <div className="flex flex-wrap gap-3">
              <a href="https://github.com/lelu-auth/lelu" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm font-medium">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                GitHub
              </a>
              <a href="https://www.npmjs.com/package/@lelu-auth/lelu" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm font-medium">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M0 7.334v8h6.666v1.332H5.334V18H8v-2.668h2.666v-8H0zm6.666 6.664H5.334v-4H3.999v4H2.666V8.667h4v5.331zm4 0v1.336H8.001V8.667h7.334v6.667h-2.667v1.332h-2zm2.667-2.667v-2.664h2.666v2.664h-2.666zm2.666 0h2.667v2.667h-2.667v-2.667zM24 7.334h-8v8h2.668v1.332h2.664V15.334h2.668v-8z"/></svg>
                npm Package
              </a>
              <a href="https://pypi.org/project/lelu-agent-auth-sdk/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm font-medium">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M14.25.18l.9.2.73.26.59.3.45.32.34.34.25.34.16.33.1.3.04.26.02.2-.01.13V8.5l-.05.63-.13.55-.21.46-.26.38-.3.31-.33.25-.35.19-.35.14-.33.1-.3.07-.26.04-.21.02H8.77l-.69.05-.59.14-.5.22-.41.27-.33.32-.27.35-.2.36-.15.37-.1.35-.07.32-.04.27-.02.21v3.06H3.17l-.21-.03-.28-.07-.32-.12-.35-.18-.36-.26-.36-.36-.35-.46-.32-.59-.28-.73-.21-.88-.14-1.05-.05-1.23.06-1.22.16-1.04.24-.87.32-.71.36-.57.4-.44.42-.33.42-.24.4-.16.36-.1.32-.05.24-.01h.16l.06.01h8.16v-.83H6.18l-.01-2.75-.02-.37.05-.34.11-.31.17-.28.25-.26.31-.23.38-.2.44-.18.51-.15.58-.12.64-.1.71-.06.77-.04.84-.02 1.27.05zm-6.3 1.98l-.23.33-.08.41.08.41.23.34.33.22.41.09.41-.09.33-.22.23-.34.08-.41-.08-.41-.23-.33-.33-.22-.41-.09-.41.09zm13.09 3.95l.28.06.32.12.35.18.36.27.36.35.35.47.32.59.28.73.21.88.14 1.04.05 1.23-.06 1.23-.16 1.04-.24.86-.32.71-.36.57-.4.45-.42.33-.42.24-.4.16-.36.09-.32.05-.24.02-.16-.01h-8.22v.82h5.84l.01 2.76.02.36-.05.34-.11.31-.17.29-.25.25-.31.24-.38.2-.44.17-.51.15-.58.13-.64.09-.71.07-.77.04-.84.01-1.27-.04-1.07-.14-.9-.2-.73-.25-.59-.3-.45-.33-.34-.34-.25-.34-.16-.33-.1-.3-.04-.25-.02-.2.01-.13v-5.34l.05-.64.13-.54.21-.46.26-.38.3-.32.33-.24.35-.2.35-.14.33-.1.3-.06.26-.04.21-.02.13-.01h5.84l.69-.05.59-.14.5-.21.41-.28.33-.32.27-.35.2-.36.15-.36.1-.35.07-.32.04-.28.02-.21V6.07h2.09l.14.01zm-6.47 14.25l-.23.33-.08.41.08.41.23.33.33.23.41.08.41-.08.33-.23.23-.33.08-.41-.08-.41-.23-.33-.33-.23-.41-.08-.41.08z"/></svg>
                PyPI Package
              </a>
              <Link href="/docs" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm font-medium">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Documentation
              </Link>
            </div>
          </div>
        </div>

        {/* Founder Section - Moved Up */}
        <div className="mb-16 pb-16 border-b border-zinc-200 dark:border-white/10">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">Founder</h2>
          
          <div className="rounded-xl border border-zinc-200 dark:border-white/10 p-8 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 max-w-2xl">
            <div className="flex items-start gap-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold shrink-0">
                AG
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2">Abenezer Getachew</h3>
                <p className="text-base text-indigo-600 dark:text-indigo-400 font-semibold mb-4">Founder & Software Engineer</p>
                <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed mb-3">
                  Software engineer with 5+ years of experience building scalable distributed systems and production infrastructure.
                </p>
                <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  Founded Lelu AI to solve the critical problem of AI agent security. Passionate about making autonomous systems safe and trustworthy for production deployment.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* The Problem - Simplified */}
        <div className="mb-16 pb-16 border-b border-zinc-200 dark:border-white/10">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">The Problem</h2>
          <p className="text-xl text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4 font-medium">
            AI agents are powerful enough to take real actions—processing refunds, modifying databases, sending emails, making business decisions.
          </p>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
            But traditional authorization systems weren't built for AI. They assume deterministic, human-driven actions.
          </p>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
            AI agents operate with uncertainty, make probabilistic decisions, and can be manipulated through prompt injection attacks. Companies need a security layer designed specifically for autonomous AI.
          </p>
        </div>

        {/* Why We Built This */}
        <div className="mb-16 pb-16 border-b border-zinc-200 dark:border-white/10">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">Why We Built Lelu</h2>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
            AI agents are moving from research prototypes to production systems. Companies like Anthropic, OpenAI, and Google are releasing increasingly capable models that can take real-world actions.
          </p>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
            But with this power comes risk:
          </p>
          <ul className="list-disc list-inside space-y-2 text-lg text-zinc-600 dark:text-zinc-400 ml-4 mb-4">
            <li>An AI agent with database access could accidentally delete critical data</li>
            <li>A customer support agent could issue unauthorized refunds</li>
            <li>A code-writing agent could introduce security vulnerabilities</li>
          </ul>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Lelu provides the security infrastructure that makes AI agents safe for production—allowing companies to move fast without breaking things.
          </p>
        </div>

        {/* What We Built - Current Stage */}
        <div className="mb-16 pb-16 border-b border-zinc-200 dark:border-white/10">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">What We Built</h2>
          <p className="text-xl text-zinc-700 dark:text-zinc-300 leading-relaxed mb-6 font-medium">
            Lelu is a complete authorization engine that evaluates every AI agent action in real-time.
          </p>
          
          <div className="mb-8 p-6 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-start gap-3 mb-3">
              <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="font-semibold text-emerald-900 dark:text-emerald-100 text-lg mb-1">Production Ready</div>
                <div className="text-emerald-800 dark:text-emerald-200">
                  Version 1.0 is live and being used by development teams building AI agent applications
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="rounded-xl border border-zinc-200 dark:border-white/10 p-6 bg-white/50 dark:bg-white/5">
              <div className="text-3xl mb-3">🎯</div>
              <h3 className="text-lg font-semibold mb-2">Confidence-Aware Control</h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Automatically routes low-confidence decisions to human reviewers, preventing costly mistakes.
              </p>
            </div>
            
            <div className="rounded-xl border border-zinc-200 dark:border-white/10 p-6 bg-white/50 dark:bg-white/5">
              <div className="text-3xl mb-3">🛡️</div>
              <h3 className="text-lg font-semibold mb-2">Prompt Injection Defense</h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Detects and blocks malicious prompts before they can manipulate agent behavior.
              </p>
            </div>
            
            <div className="rounded-xl border border-zinc-200 dark:border-white/10 p-6 bg-white/50 dark:bg-white/5">
              <div className="text-3xl mb-3">📋</div>
              <h3 className="text-lg font-semibold mb-2">Policy Enforcement</h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Define what agents can and cannot do using simple YAML or advanced Rego policies.
              </p>
            </div>
            
            <div className="rounded-xl border border-zinc-200 dark:border-white/10 p-6 bg-white/50 dark:bg-white/5">
              <div className="text-3xl mb-3">📊</div>
              <h3 className="text-lg font-semibold mb-2">Complete Audit Trail</h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Every decision is logged with full context for compliance and debugging.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
            <h3 className="font-semibold text-lg mb-3">Available SDKs & Integration</h3>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              Companies integrate Lelu using our SDKs for TypeScript, Python, and Go. All agent actions are evaluated through our authorization engine before execution.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-sm font-medium">TypeScript/Node.js</span>
              <span className="px-3 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-sm font-medium">Python</span>
              <span className="px-3 py-1 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200 text-sm font-medium">Go</span>
              <span className="px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 text-sm font-medium">Docker</span>
              <span className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-sm font-medium">Kubernetes</span>
            </div>
          </div>
        </div>

        {/* Who We Serve */}
        <div className="mb-16 pb-16 border-b border-zinc-200 dark:border-white/10">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">Who We Serve</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-3 text-indigo-600 dark:text-indigo-400">
                Enterprise Development Teams
              </h3>
              <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Companies building AI agents for customer support, internal automation, data analysis, and business operations. Teams that need to deploy AI safely while maintaining security and compliance standards.
              </p>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-3 text-indigo-600 dark:text-indigo-400">
                AI Platform Providers
              </h3>
              <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Companies offering AI agent platforms to their customers who need built-in authorization and security features without building them from scratch.
              </p>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-3 text-indigo-600 dark:text-indigo-400">
                Regulated Industries
              </h3>
              <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Financial services, healthcare, and other industries requiring strict audit trails, human oversight, and compliance documentation for AI-driven decisions.
              </p>
            </div>
          </div>
        </div>

        {/* Use Cases */}
        <div className="mb-16 pb-16 border-b border-zinc-200 dark:border-white/10">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">Real-World Use Cases</h2>
          
          <div className="space-y-8">
            <div className="rounded-xl border border-zinc-200 dark:border-white/10 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
              <h3 className="text-lg font-semibold mb-2">Customer Support Automation</h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                AI agents handle routine support tickets automatically, but high-value actions like refunds or account modifications require human approval based on confidence thresholds.
              </p>
            </div>
            
            <div className="rounded-xl border border-zinc-200 dark:border-white/10 p-6 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20">
              <h3 className="text-lg font-semibold mb-2">Database Operations</h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                AI agents can query databases freely but destructive operations (DELETE, DROP) are blocked or require explicit human review, preventing catastrophic mistakes.
              </p>
            </div>
            
            <div className="rounded-xl border border-zinc-200 dark:border-white/10 p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
              <h3 className="text-lg font-semibold mb-2">Multi-Agent Systems</h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Parent agents delegate tasks to specialized sub-agents with scoped, time-limited permissions—ensuring the principle of least privilege across agent swarms.
              </p>
            </div>
          </div>
        </div>

        {/* Technology */}
        <div className="mb-16 pb-16 border-b border-zinc-200 dark:border-white/10">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">Technology</h2>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
            Built as a modern, cloud-native platform with enterprise-grade reliability:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-zinc-200 dark:border-white/10 p-4 bg-white/50 dark:bg-white/5">
              <div className="font-semibold mb-2">Authorization Engine</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">Go-based with sub-50ms latency</div>
            </div>
            
            <div className="rounded-lg border border-zinc-200 dark:border-white/10 p-4 bg-white/50 dark:bg-white/5">
              <div className="font-semibold mb-2">Storage</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">SQLite for dev, PostgreSQL for production</div>
            </div>
            
            <div className="rounded-lg border border-zinc-200 dark:border-white/10 p-4 bg-white/50 dark:bg-white/5">
              <div className="font-semibold mb-2">Deployment</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">Docker, Kubernetes, self-hosted</div>
            </div>
            
            <div className="rounded-lg border border-zinc-200 dark:border-white/10 p-4 bg-white/50 dark:bg-white/5">
              <div className="font-semibold mb-2">Observability</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">OpenTelemetry tracing & metrics</div>
            </div>
            
            <div className="rounded-lg border border-zinc-200 dark:border-white/10 p-4 bg-white/50 dark:bg-white/5">
              <div className="font-semibold mb-2">Open Source</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">MIT License on GitHub</div>
            </div>
            
            <div className="rounded-lg border border-zinc-200 dark:border-white/10 p-4 bg-white/50 dark:bg-white/5">
              <div className="font-semibold mb-2">SDKs</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">TypeScript, Python, Go</div>
            </div>
          </div>
        </div>

        {/* Team - Removed duplicate, kept in founder section above */}

        {/* Company Info - Simplified */}
        <div className="mb-16 pb-16 border-b border-zinc-200 dark:border-white/10">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">Company Information</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Mission</h3>
              <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Make AI agents safe and trustworthy for production use. We believe autonomous AI will transform how businesses operate, but only if companies can deploy it with confidence and control.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-2">Open Source</h3>
              <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Lelu is open source (MIT License) and available on GitHub. Security infrastructure should be transparent, auditable, and community-driven. Companies can self-host or use managed services.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-2">Contact</h3>
              <div className="space-y-2 text-lg text-zinc-600 dark:text-zinc-400">
                <div>General: <a href="mailto:support@lelu-ai.com" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">support@lelu-ai.com</a></div>
                <div>Security: <a href="mailto:security@lelu-ai.com" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">security@lelu-ai.com</a></div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 p-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Ready to secure your AI agents?
            </h2>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-8 max-w-2xl mx-auto">
              Install Lelu in minutes and start building AI applications with confidence.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/docs/quickstart" className="inline-flex items-center justify-center rounded-full bg-black px-8 py-3.5 text-sm font-medium text-white shadow-lg transition-transform hover:scale-105 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
                Get Started
                <svg className="ml-2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <a href="https://github.com/lelu-auth/lelu" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white/50 px-8 py-3.5 text-sm font-medium text-zinc-900 backdrop-blur-md transition-colors hover:bg-zinc-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                View on GitHub
              </a>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
