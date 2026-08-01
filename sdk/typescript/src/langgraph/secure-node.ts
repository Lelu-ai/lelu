/**
 * LangGraph.js node wrapper for the Auth Permission Engine.
 *
 * secureNode gates any LangGraph.js node through Lelu's Confidence-Aware Auth
 * before it runs. Mirrors the Python SDK's `lelu.langgraph.secure_node`.
 *
 * Usage:
 * ```typescript
 * import { StateGraph, END } from "@langchain/langgraph";
 * import { secureNode } from "lelu-agent-auth/langgraph";
 *
 * const approveInvoice = secureNode(
 *   { client, actor: "invoice_bot", action: "invoice:approve" },
 *   async (state) => ({ ...state, approved: true })
 * );
 *
 * const graph = new StateGraph<MyState>({ channels: { ... } });
 * graph.addNode("approve", approveInvoice);
 * ```
 */

import type { LeluClient } from "../client.js";
import type { AgentAuthDecision } from "../types.js";

// ─── State keys ───────────────────────────────────────────────────────────────

/** Set on returned state when the node was denied or queued for review. */
export const LELU_DENIED_KEY = "leluDenied";
/** Set on returned state when the node's action is pending human review. */
export const LELU_REVIEW_KEY = "leluPendingReview";
/** Set on returned state to the engine's denial/review reason. */
export const LELU_REASON_KEY = "leluReason";
/**
 * Set on returned state to the queue item ID when pending, so the caller can
 * poll getQueueItem()/waitForApproval() or resolve via approveQueueItem()/
 * denyQueueItem(). Undefined otherwise.
 */
export const LELU_REVIEW_ID_KEY = "leluReviewId";

// ─── Options ──────────────────────────────────────────────────────────────────

export interface SecureNodeOptions<S extends Record<string, unknown>> {
  /** Configured LeluClient. */
  client: LeluClient;
  /** The Lelu agent scope / actor name. */
  actor: string;
  /** The permission string being checked (e.g. "invoice:approve"). */
  action: string;
  /** State key holding the LLM confidence score (0.0-1.0). Default: "confidence". */
  confidenceKey?: keyof S & string;
  /** State key holding the user ID the agent is acting for. */
  actingForKey?: keyof S & string;
  /**
   * Confidence used when `confidenceKey` is absent from state. Default:
   * undefined — omitted from the request so the engine's MissingSignalMode
   * decides instead of assuming a fabricated perfect score.
   */
  defaultConfidence?: number;
  /**
   * If true, throw `LeluDeniedError` on denial instead of returning
   * augmented state with `leluDenied: true`. Default: false.
   */
  throwOnDeny?: boolean;
}

export type LangGraphNode<S extends Record<string, unknown>> = (
  state: S
) => Promise<Partial<S>> | Partial<S>;

// ─── Error ────────────────────────────────────────────────────────────────────

/** Raised by a `secureNode` when `throwOnDeny: true` and Lelu denies. */
export class LeluDeniedError extends Error {
  constructor(
    message: string,
    public readonly reason: string
  ) {
    super(message);
    this.name = "LeluDeniedError";
  }
}

// ─── secureNode ───────────────────────────────────────────────────────────────

/**
 * Wraps a LangGraph.js node with Lelu Confidence-Aware Auth.
 *
 * 1. Calls Lelu `agentAuthorize` with the state's confidence score.
 * 2a. Allowed → runs the wrapped node function.
 * 2b. Requires human review → returns augmented state (`leluPendingReview: true`),
 *     does not run the node.
 * 2c. Denied → throws `LeluDeniedError` (if `throwOnDeny`) or returns augmented
 *     state (`leluDenied: true`) for the graph to route on.
 */
export function secureNode<S extends Record<string, unknown>>(
  options: SecureNodeOptions<S>,
  fn: LangGraphNode<S>
): LangGraphNode<S> {
  const {
    client,
    actor,
    action,
    confidenceKey = "confidence" as keyof S & string,
    actingForKey,
    defaultConfidence,
    throwOnDeny = false,
  } = options;

  return async (state: S): Promise<Partial<S>> => {
    const confidence = (state[confidenceKey] as number | undefined) ?? defaultConfidence;
    const actingFor = actingForKey ? (state[actingForKey] as string | undefined) : undefined;

    const decision: AgentAuthDecision = await client.agentAuthorize({
      actor,
      action,
      context: {
        ...(confidence !== undefined ? { confidence } : {}),
        ...(actingFor ? { actingFor } : {}),
      },
    });

    if (decision.requiresHumanReview) {
      return {
        [LELU_DENIED_KEY]: true,
        [LELU_REVIEW_KEY]: true,
        [LELU_REASON_KEY]: decision.reason,
        [LELU_REVIEW_ID_KEY]: decision.reviewId,
      } as unknown as Partial<S>;
    }

    if (!decision.allowed) {
      const message = `Lelu denied action '${action}' for actor '${actor}': ${decision.reason}`;
      if (throwOnDeny) throw new LeluDeniedError(message, decision.reason);
      return {
        [LELU_DENIED_KEY]: true,
        [LELU_REVIEW_KEY]: false,
        [LELU_REASON_KEY]: decision.reason,
      } as unknown as Partial<S>;
    }

    // `allowed` is also true for a scope downgrade or a compute redirect —
    // neither means "run the node as requested." This node has no way to
    // re-run an arbitrary function under a restricted scope or a different
    // safe tool, so both must be treated as non-executable, same as a deny.
    if (decision.downgradedScope || decision.computed) {
      const message = decision.downgradedScope
        ? `Lelu downgraded action '${action}' for actor '${actor}' to '${decision.downgradedScope}' scope: ${decision.reason}`
        : `Lelu redirected action '${action}' for actor '${actor}' to a safe alternative${decision.safeTool ? ` (${decision.safeTool})` : ""}: ${decision.reason}`;
      if (throwOnDeny) throw new LeluDeniedError(message, decision.reason);
      return {
        [LELU_DENIED_KEY]: true,
        [LELU_REVIEW_KEY]: false,
        [LELU_REASON_KEY]: decision.reason,
      } as unknown as Partial<S>;
    }

    const result = await fn(state);
    return { ...result, [LELU_DENIED_KEY]: false } as unknown as Partial<S>;
  };
}

// ─── State helpers ────────────────────────────────────────────────────────────

/** True if the last `secureNode` was denied or queued for review. */
export function wasDenied(state: Record<string, unknown>): boolean {
  return Boolean(state[LELU_DENIED_KEY]);
}

/** True if the last `secureNode` was queued for human review. */
export function pendingReview(state: Record<string, unknown>): boolean {
  return Boolean(state[LELU_REVIEW_KEY]);
}

/** The denial/review reason from state, or an empty string. */
export function denialReason(state: Record<string, unknown>): string {
  return String(state[LELU_REASON_KEY] ?? "");
}

/**
 * The queue item ID when `pendingReview(state)` is true, so the caller can
 * poll `getQueueItem()`/`waitForApproval()` or resolve via
 * `approveQueueItem()`/`denyQueueItem()`. Undefined otherwise.
 */
export function reviewId(state: Record<string, unknown>): string | undefined {
  return state[LELU_REVIEW_ID_KEY] as string | undefined;
}
