/**
 * Lelu authorization for Strands Agents.
 *
 * Strands' intervention system asks a handler what to do before each tool
 * call, and the actions it accepts line up with Lelu's decisions almost
 * exactly. That makes this a mapping rather than a translation:
 *
 *   Lelu decision   Strands action   Effect
 *   ─────────────   ──────────────   ─────────────────────────────────────
 *   allow           proceed()        the tool runs as the model intended
 *   deny            deny(reason)     cancelled; the model is told why
 *   compute         transform(...)   re-pointed at the policy's safe tool
 *   human_review    confirm(prompt)  paused for a human via the interrupt
 *
 * Usage:
 * ```typescript
 * import { Agent } from '@strands-agents/sdk';
 * import { LeluClient } from 'lelu-agent-auth';
 * import { LeluIntervention } from 'lelu-agent-auth/strands';
 *
 * const agent = new Agent({
 *   tools: [refund, lookupInvoice],
 *   interventions: [new LeluIntervention({ client, actor: 'invoice_bot' })],
 * });
 * ```
 *
 * Strands evaluates handlers in registration order and suggests putting cheap
 * authorization checks first, so this belongs at the front of the array.
 */

import {
  InterventionHandler,
  InterventionActions,
} from "@strands-agents/sdk";
import type { BeforeToolCallEvent, OnError } from "@strands-agents/sdk";

import { LeluClient } from "../client.js";

/**
 * The union of actions `beforeToolCall` may return.
 *
 * Derived from the base class rather than imported: the SDK exports the action
 * *helpers* from its root but not the union type, and deriving it here means a
 * change to the set of permitted actions surfaces as a type error rather than
 * a stale local copy that still compiles.
 */
type InterventionAction = Awaited<
  ReturnType<InterventionHandler["beforeToolCall"]>
>;
import type { AuthDecision, AuthorizeRequest, RedeemResult } from "../types.js";

// ─── Types ────────────────────────────────────────────────────────────────────

/** The parts of a tool invocation Lelu evaluates. */
export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
  toolUseId: string;
}

export type GuardAction = "allow" | "deny" | "redirect" | "review";

/** What the guard decided about a tool call, before it becomes a Strands action. */
export interface GuardOutcome {
  action: GuardAction;
  message: string;
  reason: string;
  traceId: string;
  reviewId?: string | undefined;
  replacementTool?: string | undefined;
  replacementArgs?: Record<string, unknown> | undefined;
  decision?: AuthDecision | undefined;
  /**
   * The exact request that was authorized, kept so a paused call can be
   * redeemed against an identical fingerprint. The engine binds an approval to
   * the payload it was granted for, so a rebuilt request would be refused.
   */
  request?: AuthorizeRequest | undefined;
}

export interface LeluInterventionOptions {
  /** Configured LeluClient. */
  client: LeluClient;
  /** Agent identity Lelu evaluates policy against. */
  actor: string;
  /**
   * Maps a tool name to the permission string checked in policy. Defaults to
   * the tool name unchanged.
   */
  actionFor?: ((call: ToolCall) => string) | undefined;
  /**
   * Model confidence for this call (0–1). Omit it and the engine applies its
   * configured MissingSignalMode rather than assuming a value — Lelu does not
   * treat a caller-supplied number as verified.
   */
  confidenceFor?: ((call: ToolCall) => number | undefined) | undefined;
  /** User the agent is acting on behalf of, when there is one. */
  actingFor?: string | undefined;
  /**
   * What a `human_review` decision does.
   *
   * - `"confirm"` (default) returns Strands' Confirm action, pausing the agent
   *   through its interrupt system so a human can approve or refuse in the
   *   flow the application already has.
   * - `"deny"` cancels the call instead, leaving Lelu's own review queue as
   *   the authority. Use this when approval happens out of band and you intend
   *   to resume with `redeem()`.
   */
  onReview?: "confirm" | "deny" | undefined;
  /**
   * What happens if this handler itself throws — Strands' own OnError setting.
   * Defaults to `"deny"`, which is fail-closed. Strands' default is `"throw"`;
   * we override it because a broken authorization check must not become a
   * permitted tool call.
   */
  onError?: OnError | undefined;
  /**
   * If the engine is unreachable: false (default) denies the call, true allows
   * it. Default closed — an authorization engine that permits everything when
   * it breaks is not an authorization engine.
   */
  failOpen?: boolean | undefined;
  /** Optional logger. Defaults to console. */
  logger?: Pick<Console, "debug" | "warn" | "error"> | undefined;
}

// ─── Framework-independent core ───────────────────────────────────────────────

/**
 * Turns a Lelu decision into a guard outcome. Pure and synchronous: no
 * network, no framework. This is the mapping, and the part worth testing.
 */
export function decide(
  decision: AuthDecision,
  call: ToolCall,
  actor: string,
  request?: AuthorizeRequest,
): GuardOutcome {
  const traceId = decision.requestId ?? "";
  const reason = decision.reason ?? "";

  if (decision.decision === "human_review") {
    return {
      action: "review",
      message: `[Lelu] '${call.name}' requires human approval. Reason: ${reason}`,
      reason,
      traceId,
      reviewId: decision.reviewId,
      decision,
      request,
    };
  }

  // Checked before `allowed`, because the engine reports a compute decision as
  // not-allowed for the tool that was actually requested. Reading `allowed`
  // first would turn every redirect into a denial.
  if (decision.safeTool) {
    return {
      action: "redirect",
      message: `[Lelu] '${call.name}' redirected to '${decision.safeTool}'. Reason: ${reason}`,
      reason,
      traceId,
      replacementTool: decision.safeTool,
      replacementArgs: decision.safeArgs,
      decision,
      request,
    };
  }

  if (!decision.allowed) {
    return {
      action: "deny",
      message: `[Lelu] '${call.name}' was denied for agent '${actor}'. Reason: ${reason}`,
      reason,
      traceId,
      decision,
      request,
    };
  }

  return { action: "allow", message: "", reason, traceId, decision, request };
}

/** Lifts the fields Lelu needs out of a Strands event. */
export function extractCall(event: {
  toolUse?: { name?: string; input?: unknown; toolUseId?: string } | undefined;
}): ToolCall {
  const toolUse = event?.toolUse ?? {};
  const input = toolUse.input;
  return {
    name: toolUse.name ?? "",
    arguments:
      input && typeof input === "object" ? (input as Record<string, unknown>) : {},
    toolUseId: toolUse.toolUseId ?? "",
  };
}

// ─── The intervention handler ─────────────────────────────────────────────────

export class LeluIntervention extends InterventionHandler {
  readonly name = "lelu-authorization";
  override readonly onError: OnError;

  private readonly client: LeluClient;
  private readonly actor: string;
  private readonly actionFor: (call: ToolCall) => string;
  private readonly confidenceFor: (call: ToolCall) => number | undefined;
  private readonly actingFor: string | undefined;
  private readonly onReview: "confirm" | "deny";
  private readonly failOpen: boolean;
  private readonly log: Pick<Console, "debug" | "warn" | "error">;

  constructor(options: LeluInterventionOptions) {
    super();
    this.client = options.client;
    this.actor = options.actor;
    this.actionFor = options.actionFor ?? ((call) => call.name);
    this.confidenceFor = options.confidenceFor ?? (() => undefined);
    this.actingFor = options.actingFor;
    this.onReview = options.onReview ?? "confirm";
    // Fail closed by default. Strands defaults to 'throw'; a broken policy
    // check should stop the call, not surface as an unhandled error.
    this.onError = options.onError ?? "deny";
    this.failOpen = options.failOpen ?? false;
    this.log = options.logger ?? console;
  }

  /** Asks Lelu about one tool call. Usable directly, and testable without an event. */
  async evaluate(call: ToolCall): Promise<GuardOutcome> {
    const confidence = this.confidenceFor(call);
    const context: AuthorizeRequest["context"] = {};
    if (confidence !== undefined) context.confidence = confidence;
    if (this.actingFor !== undefined) context.actingFor = this.actingFor;

    const request: AuthorizeRequest = {
      tool: this.actionFor(call),
      actor: this.actor,
      context,
    };
    if (Object.keys(call.arguments).length > 0) request.args = call.arguments;

    let decision: AuthDecision;
    try {
      decision = await this.client.authorize(request);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error(`lelu: authorization failed for tool=${call.name}: ${message}`);
      if (this.failOpen) {
        this.log.warn(
          `lelu: failing open for tool=${call.name} — the call was NOT authorized`,
        );
        return { action: "allow", message: "", reason: `engine unreachable: ${message}`, traceId: "" };
      }
      return {
        action: "deny",
        message: `[Lelu] '${call.name}' blocked: authorization engine unreachable (${message}).`,
        reason: message,
        traceId: "",
      };
    }

    const outcome = decide(decision, call, this.actor, request);
    this.log.debug(
      `lelu: tool=${call.name} action=${outcome.action} traceId=${outcome.traceId}`,
    );
    return outcome;
  }

  override async beforeToolCall(event: BeforeToolCallEvent): Promise<InterventionAction> {
    const call = extractCall(event);
    const outcome = await this.evaluate(call);
    return this.toAction(event, outcome);
  }

  /**
   * Translates an outcome into the Strands action that expresses it.
   * Separated from beforeToolCall so the mapping can be tested without
   * standing up an agent.
   */
  toAction(event: BeforeToolCallEvent, outcome: GuardOutcome): InterventionAction {
    switch (outcome.action) {
      case "allow":
        return InterventionActions.proceed({ reason: outcome.reason });

      case "redirect":
        if (outcome.replacementTool) {
          const tool = outcome.replacementTool;
          const args = outcome.replacementArgs;
          return InterventionActions.transform(
            () => {
              event.toolUse.name = tool;
              if (args !== undefined) {
                // safeArgs comes off the wire as JSON, so this is a
                // representation cast, not a claim about unchecked data.
                event.toolUse.input = args as typeof event.toolUse.input;
              }
            },
            { reason: outcome.message },
          );
        }
        // A redirect we cannot express must stop the call, not fall through to
        // running the tool that was never authorized.
        return InterventionActions.deny(outcome.message);

      case "review":
        return this.onReview === "confirm"
          ? InterventionActions.confirm(outcome.message, { reason: outcome.reason })
          : InterventionActions.deny(outcome.message);

      case "deny":
      default:
        return InterventionActions.deny(outcome.message);
    }
  }

  /**
   * Waits for a human decision on a paused call, then redeems it.
   *
   * Pass the GuardOutcome from evaluate() — it carries both the decision and
   * the exact request that was paused. Redemption re-checks that payload
   * against what the reviewer actually approved, so an approval cannot be
   * spent on a call they never saw, and it is single-use.
   *
   * Relevant when onReview is "deny" and approval happens in Lelu's own queue.
   */
  async redeem(
    outcome: GuardOutcome,
    opts?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<RedeemResult> {
    if (!outcome.decision || !outcome.request) {
      throw new Error(
        "this outcome carries no request to redeem — only a review outcome can be redeemed",
      );
    }
    return this.client.waitAndRedeem(outcome.decision, outcome.request, opts);
  }
}

/** Convenience factory, for `interventions: [leluIntervention({...})]`. */
export function leluIntervention(options: LeluInterventionOptions): LeluIntervention {
  return new LeluIntervention(options);
}
