import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';

// AI Agent Semantic Conventions (matching Go implementation)
export const AI_AGENT_ATTRIBUTES = {
  // Agent identification
  AGENT_ID: 'ai.agent.id',
  AGENT_TYPE: 'ai.agent.type',
  AGENT_VERSION: 'ai.agent.version',
  
  // Request attributes
  REQUEST_INTENT: 'ai.request.intent',
  REQUEST_CONFIDENCE: 'ai.request.confidence',
  REQUEST_ACTING_FOR: 'ai.request.acting_for',
  REQUEST_SCOPE: 'ai.request.scope',
  
  // Policy evaluation
  POLICY_NAME: 'ai.policy.name',
  POLICY_VERSION: 'ai.policy.version',
  POLICY_RESULT: 'ai.policy.result',
  
  // Decision attributes
  DECISION_TYPE: 'ai.decision.type',
  DECISION_CONFIDENCE: 'ai.decision.confidence',
  DECISION_HUMAN_REVIEW: 'ai.decision.human_review',
  DECISION_RISK_SCORE: 'ai.decision.risk_score',
  DECISION_OUTCOME: 'ai.decision.outcome',
  
  // Multi-agent correlation
  SWARM_ID: 'ai.swarm.id',
  DELEGATION_CHAIN: 'ai.delegation.chain',
  PARENT_AGENT: 'ai.parent.agent',
  CHILD_AGENT: 'ai.child.agent',
  
  // Performance metrics
  LATENCY_MS: 'ai.latency.ms',
  CONFIDENCE_GATE_MS: 'ai.latency.confidence_gate_ms',
  POLICY_EVAL_MS: 'ai.latency.policy_eval_ms',
  RISK_EVAL_MS: 'ai.latency.risk_eval_ms',
} as const;

// Agent types
export const AGENT_TYPES = {
  AUTONOMOUS: 'autonomous',
  ASSISTED: 'assisted',
  HUMAN: 'human',
} as const;

// Decision types
export const DECISION_TYPES = {
  AUTONOMOUS: 'autonomous',
  HUMAN_REVIEW: 'human_review',
  DENIED: 'denied',
} as const;

export interface AgentSpanOptions {
  agentId: string;
  agentType?: string;
  action?: string | undefined;
  confidence?: number | undefined;
  actingFor?: string | undefined;
  scope?: string | undefined;
}

export interface DecisionMetrics {
  allowed: boolean;
  requiresHumanReview: boolean;
  confidence: number;
  riskScore: number;
  outcome: string;
}

export interface LatencyMetrics {
  totalMs: number;
  confidenceGateMs?: number;
  policyEvalMs?: number;
  riskEvalMs?: number;
}

/**
 * AgentTracer provides AI agent-aware tracing capabilities for the TypeScript SDK
 */
export class AgentTracer {
  private tracer = trace.getTracer('lelu-sdk-typescript', '0.2.0');

  /**
   * Start a new span with AI agent semantic conventions
   */
  startAgentSpan(operationName: string, options: AgentSpanOptions) {
    const span = this.tracer.startSpan(operationName, {
      kind: SpanKind.CLIENT,
      attributes: {
        [AI_AGENT_ATTRIBUTES.AGENT_ID]: options.agentId,
        [AI_AGENT_ATTRIBUTES.AGENT_TYPE]: options.agentType || AGENT_TYPES.AUTONOMOUS,
        ...(options.action && { [AI_AGENT_ATTRIBUTES.REQUEST_INTENT]: options.action }),
        ...(options.confidence !== undefined && { [AI_AGENT_ATTRIBUTES.REQUEST_CONFIDENCE]: options.confidence }),
        ...(options.actingFor && { [AI_AGENT_ATTRIBUTES.REQUEST_ACTING_FOR]: options.actingFor }),
        ...(options.scope && { [AI_AGENT_ATTRIBUTES.REQUEST_SCOPE]: options.scope }),
      },
    });

    return span;
  }

  /**
   * Start an authorization span
   */
  startAuthorizationSpan(agentId: string, action: string, confidence: number) {
    return this.startAgentSpan('ai.agent.authorize', {
      agentId,
      action,
      confidence,
      agentType: AGENT_TYPES.AUTONOMOUS,
    });
  }

  /**
   * Start a delegation span
   */
  startDelegationSpan(delegator: string, delegatee: string) {
    const span = this.startAgentSpan('ai.agent.delegate', {
      agentId: delegator,
    });

    span.setAttributes({
      [AI_AGENT_ATTRIBUTES.PARENT_AGENT]: delegator,
      [AI_AGENT_ATTRIBUTES.CHILD_AGENT]: delegatee,
      [AI_AGENT_ATTRIBUTES.DELEGATION_CHAIN]: `${delegator}→${delegatee}`,
    });

    return span;
  }

  /**
   * Start a swarm orchestration span
   */
  startSwarmSpan(swarmId: string, orchestrator: string, agents: string[]) {
    const span = this.startAgentSpan('ai.swarm.orchestration', {
      agentId: orchestrator,
      agentType: 'orchestrator',
    });

    span.setAttributes({
      [AI_AGENT_ATTRIBUTES.SWARM_ID]: swarmId,
      'ai.swarm.orchestrator': orchestrator,
      'ai.swarm.agents': agents,
      'ai.swarm.agent_count': agents.length,
    });

    return span;
  }

  /**
   * Record policy evaluation details
   */
  recordPolicyEvaluation(
    span: any,
    policyName: string,
    policyVersion: string,
    result: string,
    latencyMs: number
  ) {
    if (!span) return;

    span.setAttributes({
      [AI_AGENT_ATTRIBUTES.POLICY_NAME]: policyName,
      [AI_AGENT_ATTRIBUTES.POLICY_VERSION]: policyVersion,
      [AI_AGENT_ATTRIBUTES.POLICY_RESULT]: result,
      [AI_AGENT_ATTRIBUTES.POLICY_EVAL_MS]: latencyMs,
    });
  }

  /**
   * Record the final authorization decision
   */
  recordDecision(span: any, metrics: DecisionMetrics) {
    if (!span) return;

    const decisionType = metrics.requiresHumanReview
      ? DECISION_TYPES.HUMAN_REVIEW
      : metrics.allowed
      ? DECISION_TYPES.AUTONOMOUS
      : DECISION_TYPES.DENIED;

    span.setAttributes({
      [AI_AGENT_ATTRIBUTES.DECISION_TYPE]: decisionType,
      [AI_AGENT_ATTRIBUTES.DECISION_CONFIDENCE]: metrics.confidence,
      [AI_AGENT_ATTRIBUTES.DECISION_HUMAN_REVIEW]: metrics.requiresHumanReview,
      [AI_AGENT_ATTRIBUTES.DECISION_RISK_SCORE]: metrics.riskScore,
      [AI_AGENT_ATTRIBUTES.DECISION_OUTCOME]: metrics.outcome,
    });

    // Set span status based on decision
    if (!metrics.allowed && !metrics.requiresHumanReview) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'Authorization denied' });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }
  }

  /**
   * Record operation latency
   */
  recordLatency(span: any, metrics: LatencyMetrics) {
    if (!span) return;

    span.setAttributes({
      [AI_AGENT_ATTRIBUTES.LATENCY_MS]: metrics.totalMs,
      ...(metrics.confidenceGateMs && { [AI_AGENT_ATTRIBUTES.CONFIDENCE_GATE_MS]: metrics.confidenceGateMs }),
      ...(metrics.policyEvalMs && { [AI_AGENT_ATTRIBUTES.POLICY_EVAL_MS]: metrics.policyEvalMs }),
      ...(metrics.riskEvalMs && { [AI_AGENT_ATTRIBUTES.RISK_EVAL_MS]: metrics.riskEvalMs }),
    });
  }

  /**
   * Inject correlation context for multi-agent tracing
   */
  injectCorrelationContext(span: any, delegationChain: string) {
    if (!span) return;

    span.setAttributes({
      [AI_AGENT_ATTRIBUTES.DELEGATION_CHAIN]: delegationChain,
    });
  }

  /**
   * Execute a function within an agent span context
   */
  async withAgentSpan<T>(
    operationName: string,
    options: AgentSpanOptions,
    fn: (span: any) => Promise<T>
  ): Promise<T> {
    const span = this.startAgentSpan(operationName, options);
    
    try {
      const result = await context.with(trace.setSpan(context.active(), span), () => fn(span));
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      throw error;
    } finally {
      span.end();
    }
  }
}

// Export a default instance
export const agentTracer = new AgentTracer();