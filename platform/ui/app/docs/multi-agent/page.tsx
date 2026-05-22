export default function DocsMultiAgent() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-100 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 text-sm font-medium mb-6">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          Advanced Features
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">
          Multi-Agent Coordination
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Track and coordinate complex workflows involving multiple AI agents with delegation
          chains, swarm operations, and distributed trace correlation.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Overview</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Multi-agent coordination enables AI agents to delegate tasks to other agents, work
            together in swarms, and maintain full traceability across complex authorization
            workflows. Every delegation and collaboration is tracked with correlation IDs and
            distributed tracing.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
              <div className="text-2xl mb-2">🔗</div>
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">Delegation Chains</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Track agent-to-agent delegations with full authorization context propagation.
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-5">
              <div className="text-2xl mb-2">🐝</div>
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">Swarm Operations</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Coordinate multiple agents working together on complex tasks.
              </p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5">
              <div className="text-2xl mb-2">🔍</div>
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Correlation Tracking
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Maintain trace context across distributed agent operations.
              </p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
              <div className="text-2xl mb-2">🎫</div>
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">Token Delegation</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                JIT token minting for delegated authorization requests.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Delegation Chains
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            When one agent delegates a task to another agent, Lelu creates a delegation chain that
            tracks the entire authorization flow. Each step in the chain is recorded with full
            context.
          </p>

          <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
            <h3 className="font-medium text-zinc-900 dark:text-white mb-4">Delegation Flow</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-medium">
                  1
                </div>
                <div>
                  <div className="font-medium text-zinc-900 dark:text-white">
                    Agent A starts task
                  </div>
                  <div className="text-zinc-600 dark:text-zinc-400">
                    Creates delegation chain with correlation ID
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-medium">
                  2
                </div>
                <div>
                  <div className="font-medium text-zinc-900 dark:text-white">
                    Agent A delegates to Agent B
                  </div>
                  <div className="text-zinc-600 dark:text-zinc-400">Chain extended: A → B</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-medium">
                  3
                </div>
                <div>
                  <div className="font-medium text-zinc-900 dark:text-white">
                    Agent B delegates to Agent C
                  </div>
                  <div className="text-zinc-600 dark:text-zinc-400">Chain extended: A → B → C</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-medium">
                  4
                </div>
                <div>
                  <div className="font-medium text-zinc-900 dark:text-white">
                    Full trace available
                  </div>
                  <div className="text-zinc-600 dark:text-zinc-400">
                    View complete delegation path in observability tools
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono">typescript</span>
            </div>
            <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              <pre>
                <code>{`import { createClient } from 'lelu-agent-auth';

const lelu = createClient({ apiKey: process.env.LELU_API_KEY });

// Agent A starts a task and delegates to Agent B
const delegationResult = await lelu.agentAuthorize({
  actor: 'agent-a',
  action: 'task:process',
  resource: { task_id: '12345' },
  context: {
    confidence: 0.85,
    // Delegation context
    delegateTo: 'agent-b',
    delegationReason: 'Specialized processing required',
  },
});

// Delegation chain is automatically tracked
console.log('Chain ID:', delegationResult.chainId);
console.log('Chain:', delegationResult.delegationChain); // "agent-a → agent-b"

// Agent B can extend the chain further
const extendedResult = await lelu.agentAuthorize({
  actor: 'agent-b',
  action: 'subtask:execute',
  resource: { task_id: '12345' },
  context: {
    confidence: 0.90,
    chainId: delegationResult.chainId, // Link to existing chain
    delegateTo: 'agent-c',
  },
});

console.log('Extended chain:', extendedResult.delegationChain); // "agent-a → agent-b → agent-c"`}</code>
              </pre>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Swarm Operations
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Swarm operations coordinate multiple agents working together on a shared task. An
            orchestrator agent manages the swarm and tracks all participating agents.
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono">typescript</span>
            </div>
            <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              <pre>
                <code>{`// Orchestrator starts a swarm operation
const swarmResult = await lelu.startSwarmOperation({
  swarmId: 'data-processing-swarm-001',
  orchestrator: 'orchestrator-agent',
  agents: ['worker-agent-1', 'worker-agent-2', 'worker-agent-3'],
  task: {
    action: 'data:process',
    resource: { dataset_id: 'large-dataset' },
  },
});

console.log('Swarm ID:', swarmResult.swarmId);
console.log('Agents:', swarmResult.agents);

// Add more agents dynamically
await lelu.addSwarmAgent({
  swarmId: 'data-processing-swarm-001',
  agentId: 'worker-agent-4',
});

// Each agent's work is tracked under the swarm context
const workerResult = await lelu.agentAuthorize({
  actor: 'worker-agent-1',
  action: 'data:process_chunk',
  resource: { chunk_id: '001' },
  context: {
    confidence: 0.92,
    swarmId: 'data-processing-swarm-001',
  },
});

// View swarm status
const swarmStatus = await lelu.getSwarmStatus('data-processing-swarm-001');
console.log('Active agents:', swarmStatus.activeAgents);
console.log('Completed tasks:', swarmStatus.completedTasks);`}</code>
              </pre>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Correlation Headers
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Lelu automatically injects correlation headers into outgoing requests and extracts them
            from incoming requests to maintain trace context across distributed systems.
          </p>

          <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
            <h3 className="font-medium text-zinc-900 dark:text-white mb-4">Correlation Headers</h3>
            <div className="space-y-3 text-sm font-mono">
              <div className="flex items-start gap-3">
                <div className="text-blue-600 dark:text-blue-400 font-medium min-w-[200px]">
                  X-Trace-ID
                </div>
                <div className="text-zinc-600 dark:text-zinc-400">OpenTelemetry trace ID</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="text-blue-600 dark:text-blue-400 font-medium min-w-[200px]">
                  X-Span-ID
                </div>
                <div className="text-zinc-600 dark:text-zinc-400">Current span ID</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="text-blue-600 dark:text-blue-400 font-medium min-w-[200px]">
                  X-Delegation-Chain
                </div>
                <div className="text-zinc-600 dark:text-zinc-400">
                  Agent delegation path (e.g., "A→B→C")
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="text-blue-600 dark:text-blue-400 font-medium min-w-[200px]">
                  X-Chain-ID
                </div>
                <div className="text-zinc-600 dark:text-zinc-400">
                  Unique delegation chain identifier
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="text-blue-600 dark:text-blue-400 font-medium min-w-[200px]">
                  X-Swarm-ID
                </div>
                <div className="text-zinc-600 dark:text-zinc-400">Swarm operation identifier</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="text-blue-600 dark:text-blue-400 font-medium min-w-[200px]">
                  X-Swarm-Orchestrator
                </div>
                <div className="text-zinc-600 dark:text-zinc-400">Orchestrator agent ID</div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-6">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5 flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono">http headers</span>
            </div>
            <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              <pre>
                <code>{`POST /v1/agent/authorize HTTP/1.1
Host: lelu-engine:8080
Content-Type: application/json
X-Trace-ID: 4bf92f3577b34da6a3ce929d0e0e4736
X-Span-ID: 00f067aa0ba902b7
X-Delegation-Chain: orchestrator→worker-1→worker-2
X-Chain-ID: delegation_orchestrator_1234567890
X-Swarm-ID: data-processing-swarm-001
X-Swarm-Orchestrator: orchestrator-agent`}</code>
              </pre>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Viewing Multi-Agent Traces
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Use Jaeger or any OpenTelemetry-compatible tool to visualize multi-agent workflows.
            Delegation chains and swarm operations appear as connected spans in the trace view.
          </p>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4 flex gap-3 mb-6">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Search for traces by swarm ID or chain ID to see the complete multi-agent workflow in
              one view.
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Jaeger Query Examples
              </h3>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1 font-mono">
                <li>• ai.correlation.chain_id="delegation_orchestrator_1234567890"</li>
                <li>• ai.swarm.id="data-processing-swarm-001"</li>
                <li>• ai.agent.id="orchestrator-agent"</li>
                <li>• ai.delegation.chain="orchestrator→worker-1→worker-2"</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            Best Practices
          </h2>

          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">Limit Chain Depth</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Keep delegation chains under 5 levels to maintain performance and debuggability.
              </p>
            </div>

            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Use Swarms for Parallel Work
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                When multiple agents work independently on parts of a task, use swarm operations
                instead of delegation chains.
              </p>
            </div>

            <div className="border-l-4 border-purple-500 pl-4">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">Propagate Context</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Always include chain IDs and swarm IDs in authorization requests to maintain trace
                correlation.
              </p>
            </div>

            <div className="border-l-4 border-amber-500 pl-4">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Monitor Swarm Health
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Track swarm metrics to identify bottlenecks and optimize agent coordination.
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a
          href="/docs/risk-assessment"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
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
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Previous: Risk Assessment
        </a>
        <a
          href="/docs/prompt-injection"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          Next: Prompt Injection Detection
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
