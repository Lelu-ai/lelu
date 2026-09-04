/**
 * Lelu integration for Strands Agents (TypeScript).
 *
 * Strands fires `BeforeToolCallEvent` after a tool has been resolved but
 * before it runs, and lets a hook cancel the call, swap in a different tool,
 * or rewrite the arguments. Those are the same outcomes Lelu returns, so this
 * is a mapping rather than a translation:
 *
 *   Lelu decision   Strands action
 *   ─────────────   ────────────────────────────────────────────────
 *   allow           return; the tool runs as the model intended
 *   deny            cancel the call, with the policy's reason
 *   compute         re-point the call at the engine's safeTool
 *   human_review    cancel and surface the reviewId (see below)
 *
 * Usage:
 * ```typescript
 * import { Agent } from '@strands-agents/sdk';
 * import { LeluClient } from 'lelu-agent-auth';
 * import { leluGuard } from 'lelu-agent-auth/strands';
 *
 * const agent = new Agent({
 *   tools: [refund, lookup],
 *   plugins: [leluGuard({ client, actor: 'invoice_bot' })],
 * });
 * ```
 *
 * On human review
 * ---------------
 * `human_review` means a person has to decide, which a synchronous hook
 * cannot wait for without blocking the agent indefinitely. The call is
 * cancelled and the reviewId surfaced so the caller can resume deliberately.
 *
 * The call is cancelled rather than blocked forever, and `guard.redeem()`
 * resumes it once a human has acted — redemption re-checks the payload against
 * what the reviewer actually approved, so an approval cannot be spent on a
 * call they never saw.
 */

import { LeluClient } from "../client.js";
import type { AuthDecision, AuthorizeRequest, RedeemResult } from "../types.js";

// ─── The pieces of a Strands tool call we need ────────────────────────────────

/**
 * Structural type for the event Strands passes to a BeforeToolCall hook.
 * Declared here rather than imported so this module does not add a hard
 * dependency on the Strands SDK, and so a field moving does not break the
 * build for people who never use this integration.
 */
export interface BeforeToolCallEventLike {
  toolUse?: {
    name?: string | undefined;
    input?: Record<string, unknown> | undefined;
    toolUseId?: string | undefined;
  } | undefined;
  /** Set to prevent the tool from executing. */
  cancel?: unknown;
  /** Set to run a different tool in place of the registry's match. */
  selectedTool?: unknown;
}

/** The parts of a tool invocation Lelu evaluates. */
export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
  toolUseId: string;
}

export type GuardAction = "allow" | "deny" | "redirect" | "review";

/** What the guard decided to do about a tool call. */
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
   * The exact request that was authorized. Kept so a paused call can be
   * redeemed against an identical fingerprint — the engine binds an approval
   * to the payload it was granted for, so a rebuilt request would be refused.
   */
  request?: AuthorizeRequest | undefined;
}

export interface LeluGuardOptions {
  /** Configured LeluClient. */
  client: LeluClient;
  /** Agent identity Lelu evaluates policy against. */
  actor: string;
  /**
   * Maps a tool name to the permission string checked in policy. Defaults to
   * the tool name unchanged, which is usually what you want.
   */
  actionFor?: (call: ToolCall) => string;
  /**
   * Model confidence for this call (0–1). Omit it and the engine applies its
   * configured MissingSignalMode rather than assuming a value — Lelu does not
   * treat a caller-supplied number as verified.
   */
  confidenceFor?: (call: ToolCall) => number | undefined;
  /** User the agent is acting on behalf of, when there is one. */
  actingFor?: string | undefined;
  /**
   * Throw instead of cancelling on a denial. Cancelling is the default because
   * it lets the model read the reason and choose something else, which is
   * usually more useful than an exception.
   */
  throwOnDeny?: boolean;
  /**
   * If the engine is unreachable: false (default) cancels the call, true
   * allows it. Default closed — an authorization engine that allows
   * everything when it breaks is not an authorization engine.
   */
  failOpen?: boolean;
  /** Optional logger. Defaults to console. */
  logger?: Pick<Console, "debug" | "warn" | "error">;
}

export class LeluPermissionDeniedError extends Error {
  constructor(
    message: string,
    public readonly reason: string,
    public readonly traceId: string = "",
  ) {
    super(message);
    this.name = "LeluPermissionDeniedError";
  }
}

// ─── Framework-independent core ───────────────────────────────────────────────

/**
 * Turns a Lelu decision into a Strands outcome. Pure and synchronous: no
 * network, no framework. This is where the mapping lives, and it is the part
 * worth testing.
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
      message: `[Lelu] '${call.name}' requires human review before it can run. Reason: ${reason}`,
      reason,
      traceId,
      reviewId: decision.reviewId,
      decision,
      request,
    };
  }

  // Checked before `allowed`, because the engine reports a compute decision as
  // not-allowed for the tool that was actually asked for. Reading `allowed`
  // first would turn a redirect into a denial.
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
export function extractCall(event: BeforeToolCallEventLike): ToolCall {
  const toolUse = event?.toolUse ?? {};
  return {
    name: toolUse.name ?? "",
    arguments: toolUse.input ?? {},
    toolUseId: toolUse.toolUseId ?? "",
  };
}

/** Writes an outcome back onto a Strands event. */
export function applyOutcome(
  event: BeforeToolCallEventLike,
  outcome: GuardOutcome,
): void {
  if (outcome.action === "allow") return;

  if (outcome.action === "redirect" && outcome.replacementTool) {
    // Renaming makes Strands re-resolve the tool from its own registry, which
    // is what we want: the safe tool is looked up by name rather than smuggled
    // in as an object this integration constructed.
    if (event.toolUse) {
      event.toolUse.name = outcome.replacementTool;
      if (outcome.replacementArgs !== undefined) {
        event.toolUse.input = outcome.replacementArgs;
      }
      return;
    }
    // No usable toolUse — fall through and cancel rather than let an
    // unauthorized call proceed because a field was not where expected.
  }

  event.cancel = outcome.message || true;
}

// ─── The guard ────────────────────────────────────────────────────────────────

export class LeluGuard {
  private readonly client: LeluClient;
  private readonly actor: string;
  private readonly actionFor: (call: ToolCall) => string;
  private readonly confidenceFor: (call: ToolCall) => number | undefined;
  private readonly actingFor: string | undefined;
  private readonly throwOnDeny: boolean;
  private readonly failOpen: boolean;
  private readonly log: Pick<Console, "debug" | "warn" | "error">;

  constructor(options: LeluGuardOptions) {
    this.client = options.client;
    this.actor = options.actor;
    this.actionFor = options.actionFor ?? ((call) => call.name);
    this.confidenceFor = options.confidenceFor ?? (() => undefined);
    this.actingFor = options.actingFor;
    this.throwOnDeny = options.throwOnDeny ?? false;
    this.failOpen = options.failOpen ?? false;
    this.log = options.logger ?? console;
  }

  /** Asks Lelu about one tool call. */
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

  /**
   * Waits for a human decision on a paused call, then redeems it.
   *
   * Pass the GuardOutcome returned by evaluate() — it carries both the
   * decision and the exact request that was paused. Redemption re-checks that
   * payload against what the reviewer actually approved, so an approval cannot
   * be spent on a call they never saw, and it is single-use.
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

  /** The BeforeToolCall hook itself. */
  async beforeToolCall(event: BeforeToolCallEventLike): Promise<void> {
    const call = extractCall(event);
    const outcome = await this.evaluate(call);
    applyOutcome(event, outcome);

    if (outcome.action === "deny" && this.throwOnDeny) {
      throw new LeluPermissionDeniedError(outcome.message, outcome.reason, outcome.traceId);
    }
  }
}

/**
 * Convenience factory returning a plugin-shaped object, so it can be dropped
 * straight into a Strands `plugins` array.
 */
export function leluGuard(options: LeluGuardOptions) {
  const guard = new LeluGuard(options);
  return {
    name: "lelu-authorization",
    guard,
    beforeToolCall: (event: BeforeToolCallEventLike) => guard.beforeToolCall(event),
  };
}
