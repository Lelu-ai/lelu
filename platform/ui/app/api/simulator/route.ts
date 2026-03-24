import { NextRequest, NextResponse } from 'next/server';

interface Trace {
  id: string;
  kind: 'human' | 'agent';
  user_id?: string;
  actor?: string;
  action: string;
  confidence_signal?: {
    provider: string;
    token_logprobs: number[];
  };
}

interface SimulatorRequest {
  proposed_policy_yaml: string;
  traces: Trace[];
}

interface SimulatorItem {
  id: string;
  kind: string;
  changed: boolean;
  before: { outcome: string; reason: string };
  after: { outcome: string; reason: string };
}

interface SimulatorResult {
  summary: {
    total: number;
    changed: number;
    unchanged: number;
    allow_to_deny: number;
    allow_to_review: number;
    deny_to_allow: number;
    review_to_allow: number;
    review_to_deny: number;
    deny_to_review: number;
  };
  items: SimulatorItem[];
}

/**
 * Policy Simulator API
 * 
 * This endpoint simulates a proposed policy change against historical traces
 * to show the "blast radius" - what decisions would change.
 */
export async function POST(request: NextRequest) {
  try {
    const body: SimulatorRequest = await request.json();
    
    if (!body.proposed_policy_yaml || !body.traces) {
      return NextResponse.json(
        { error: 'Missing required fields: proposed_policy_yaml and traces' },
        { status: 400 }
      );
    }

    // Simulate the policy change
    const result = simulatePolicyChange(body.proposed_policy_yaml, body.traces);
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Simulator error:', error);
    return NextResponse.json(
      { error: error.message || 'Simulation failed' },
      { status: 500 }
    );
  }
}

/**
 * Simulates a policy change against historical traces
 * 
 * This is a simplified implementation that demonstrates the concept.
 * In production, this would:
 * 1. Parse the YAML policy
 * 2. Evaluate each trace against the current policy (before)
 * 3. Evaluate each trace against the proposed policy (after)
 * 4. Compare the results and compute the blast radius
 */
function simulatePolicyChange(policyYaml: string, traces: Trace[]): SimulatorResult {
  const items: SimulatorItem[] = [];
  
  const summary = {
    total: traces.length,
    changed: 0,
    unchanged: 0,
    allow_to_deny: 0,
    allow_to_review: 0,
    deny_to_allow: 0,
    review_to_allow: 0,
    review_to_deny: 0,
    deny_to_review: 0,
  };

  // Parse the proposed policy to understand the rules
  const policy = parsePolicyYaml(policyYaml);

  for (const trace of traces) {
    // Evaluate with current policy (before)
    const before = evaluateTrace(trace, 'current');
    
    // Evaluate with proposed policy (after)
    const after = evaluateTrace(trace, 'proposed', policy);
    
    const changed = before.outcome !== after.outcome;
    
    items.push({
      id: trace.id,
      kind: trace.kind,
      changed,
      before,
      after,
    });

    if (changed) {
      summary.changed++;
      
      // Track specific transitions
      const transition = `${before.outcome}_to_${after.outcome}`;
      if (transition === 'allow_to_deny') summary.allow_to_deny++;
      else if (transition === 'allow_to_review') summary.allow_to_review++;
      else if (transition === 'deny_to_allow') summary.deny_to_allow++;
      else if (transition === 'review_to_allow') summary.review_to_allow++;
      else if (transition === 'review_to_deny') summary.review_to_deny++;
      else if (transition === 'deny_to_review') summary.deny_to_review++;
    } else {
      summary.unchanged++;
    }
  }

  return { summary, items };
}

/**
 * Parse YAML policy to extract rules
 * This is a simplified parser - in production, use a proper YAML parser
 */
function parsePolicyYaml(yaml: string): any {
  const policy: any = {
    roles: {},
    agent_scopes: {},
  };

  try {
    // Extract agent_scopes section
    const agentScopesMatch = yaml.match(/agent_scopes:\s*([\s\S]*?)(?=\n\w|$)/);
    if (agentScopesMatch) {
      const agentScopesText = agentScopesMatch[1];
      
      // Extract confidence thresholds
      const humanApprovalMatch = agentScopesText.match(/require_human_approval_if_confidence_below:\s*([\d.]+)/);
      const readOnlyMatch = agentScopesText.match(/downgrade_to_read_only_if_confidence_below:\s*([\d.]+)/);
      const hardDenyMatch = agentScopesText.match(/hard_deny_if_confidence_below:\s*([\d.]+)/);
      
      policy.humanApprovalThreshold = humanApprovalMatch ? parseFloat(humanApprovalMatch[1]) : 0.90;
      policy.readOnlyThreshold = readOnlyMatch ? parseFloat(readOnlyMatch[1]) : 0.70;
      policy.hardDenyThreshold = hardDenyMatch ? parseFloat(hardDenyMatch[1]) : 0.50;
      
      // Extract deny list
      const denyMatch = agentScopesText.match(/deny:\s*\[(.*?)\]/);
      if (denyMatch) {
        policy.denyActions = denyMatch[1].split(',').map(a => a.trim().replace(/['"]/g, ''));
      } else {
        policy.denyActions = [];
      }
      
      // Extract allow list
      const allowMatch = agentScopesText.match(/allow:\s*\[(.*?)\]/);
      if (allowMatch) {
        policy.allowActions = allowMatch[1].split(',').map(a => a.trim().replace(/['"]/g, ''));
      } else {
        policy.allowActions = [];
      }
    }
  } catch (error) {
    console.error('Error parsing policy YAML:', error);
  }

  return policy;
}

/**
 * Evaluate a trace against a policy
 */
function evaluateTrace(
  trace: Trace,
  policyType: 'current' | 'proposed',
  proposedPolicy?: any
): { outcome: string; reason: string } {
  // For human traces, always allow
  if (trace.kind === 'human') {
    return {
      outcome: 'allow',
      reason: 'Human action - always allowed',
    };
  }

  // For agent traces, evaluate based on policy
  const action = trace.action;
  
  // Current policy (baseline)
  if (policyType === 'current') {
    // Simulate current policy: deny delete actions, require review for refunds
    if (action === 'delete_invoices') {
      return {
        outcome: 'deny',
        reason: 'Delete actions are denied by current policy',
      };
    }
    if (action === 'approve_refunds') {
      return {
        outcome: 'review',
        reason: 'Refunds require human approval in current policy',
      };
    }
    return {
      outcome: 'allow',
      reason: 'Action allowed by current policy',
    };
  }

  // Proposed policy
  if (proposedPolicy) {
    // Check if action is in deny list
    if (proposedPolicy.denyActions.includes(action)) {
      return {
        outcome: 'deny',
        reason: 'Action is in deny list',
      };
    }

    // Calculate confidence from trace
    let confidence = 1.0;
    if (trace.confidence_signal?.token_logprobs) {
      // Convert log probs to confidence (simplified)
      const avgLogProb = trace.confidence_signal.token_logprobs.reduce((a, b) => a + b, 0) / 
                         trace.confidence_signal.token_logprobs.length;
      confidence = Math.exp(avgLogProb);
    }

    // Apply confidence-based rules
    if (confidence < proposedPolicy.hardDenyThreshold) {
      return {
        outcome: 'deny',
        reason: `Confidence ${confidence.toFixed(2)} below hard deny threshold ${proposedPolicy.hardDenyThreshold}`,
      };
    }
    
    if (confidence < proposedPolicy.readOnlyThreshold) {
      return {
        outcome: 'deny',
        reason: `Confidence ${confidence.toFixed(2)} below read-only threshold ${proposedPolicy.readOnlyThreshold}`,
      };
    }
    
    if (confidence < proposedPolicy.humanApprovalThreshold) {
      return {
        outcome: 'review',
        reason: `Confidence ${confidence.toFixed(2)} below human approval threshold ${proposedPolicy.humanApprovalThreshold}`,
      };
    }

    // Check if action is explicitly allowed
    if (proposedPolicy.allowActions.length > 0 && proposedPolicy.allowActions.includes(action)) {
      return {
        outcome: 'allow',
        reason: 'Action is in allow list and confidence is sufficient',
      };
    }

    // Default allow if confidence is high enough
    return {
      outcome: 'allow',
      reason: `Confidence ${confidence.toFixed(2)} meets threshold`,
    };
  }

  return {
    outcome: 'allow',
    reason: 'Default allow',
  };
}
