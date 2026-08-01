/**
 * SecureTool — LangChain tool wrapper with Confidence-Aware Auth
 *
 * Intercepts every tool call and gates it through the Lelu engine before
 * execution. Returns a structured refusal string when denied so the LLM can
 * self-correct, queue for human review, or escalate.
 *
 * Usage:
 * ```typescript
 * import { SecureTool } from 'lelu/langchain';
 *
 * const refundTool = new SecureTool({
 *   name: 'process_refund',
 *   description: 'Processes a customer refund',
 *   actor: 'invoice_bot',
 *   requiredPermission: 'invoice:refund',
 *   client: leluClient,
 *   func: async (input) => {
 *     // your tool implementation
 *     return `Refund processed for ${input}`;
 *   },
 * });
 * ```
 */

import { LeluClient } from "../client.js";

// ─── Minimal LangChain-compatible interface ───────────────────────────────────

/** Minimal interface a wrapped tool must expose. */
export interface ToolLike {
  name: string;
  description: string;
  /** LangChain StructuredTool / DynamicTool use `invoke`. */
  invoke?: (input: string, ...args: unknown[]) => Promise<string>;
  /** Older LangChain versions use `call`. */
  call?: (input: string, ...args: unknown[]) => Promise<string>;
}

// ─── Options ──────────────────────────────────────────────────────────────────

export interface SecureToolOptions {
  /** Unique tool name (used as the action in authz request). */
  name: string;
  /** Human-readable description forwarded to the LLM. */
  description: string;
  /** The Lelu agent scope / actor name. */
  actor: string;
  /** The permission string being checked (e.g. "invoice:refund"). */
  requiredPermission: string;
  /** Configured LeluClient. */
  client: LeluClient;
  /** The actual tool function to execute when authorized. */
  func: (input: string) => Promise<string>;
  /**
   * Optional: LLM confidence score for this invocation (0.0–1.0).
   * Omit to let the engine apply its MissingSignalMode policy — use
   * LeluClient.confidenceFrom to derive from provider logprobs.
   */
  confidence?: number;
  /**
   * Optional: the human user the agent is acting on behalf of.
   */
  actingFor?: string;
  /**
   * Optional: if true, throw an error when denied instead of returning
   * a structured refusal string. Default: false (silent fail, structured msg).
   */
  throwOnDeny?: boolean;
}

// ─── Result ───────────────────────────────────────────────────────────────────

export interface ToolCallResult {
  allowed: boolean;
  output: string;
  requiresHumanReview: boolean;
  reviewId?: string;
  reason: string;
}

// ─── SecureTool ───────────────────────────────────────────────────────────────

/**
 * SecureTool wraps a tool function with Lelu's Confidence-Aware Auth gate.
 *
 * Implements the LangChain Tool interface (name + description + invoke)
 * so it can be dropped into any LangChain agent tool array:
 * ```typescript
 * const agent = await createOpenAIFunctionsAgent({ tools: [refundTool] });
 * ```
 */
export class SecureTool {
  readonly name: string;
  readonly description: string;

  private readonly opts: SecureToolOptions;

  constructor(opts: SecureToolOptions) {
    this.opts = opts;
    this.name = opts.name;
    this.description = opts.description;
  }

  /**
   * invoke — LangChain StructuredTool / DynamicTool compatible entry point.
   *
   * 1. Calls Lelu `agentAuthorize` with the confidence score
   * 2a. Allowed → runs the wrapped tool function
   * 2b. Requires human review → returns structured "pending" message
   * 2c. Denied → returns structured refusal string (LLM can self-correct)
   */
  async invoke(input: string): Promise<string> {
    const result = await this._check(input);
    if (result.allowed) {
      return result.output;
    }
    if (this.opts.throwOnDeny) {
      throw new Error(`[Lelu] Tool "${this.name}" denied: ${result.reason}`);
    }
    return result.output; // structured refusal or pending message
  }

  /** call — alias for older LangChain versions. */
  async call(input: string): Promise<string> {
    return this.invoke(input);
  }

  /**
   * Check authorization and run the tool if permitted.
   * Returns a full ToolCallResult for programmatic consumers.
   */
  async checkAndCall(input: string): Promise<ToolCallResult> {
    return this._check(input);
  }

  private async _check(input: string): Promise<ToolCallResult> {
    const { actor, requiredPermission, client, func, throwOnDeny } = this.opts;
    const confidence = this.opts.confidence;
    const actingFor = this.opts.actingFor ?? "";

    let decision;
    try {
      decision = await client.agentAuthorize({
        actor,
        action: requiredPermission,
        context: {
          ...(confidence !== undefined ? { confidence } : {}),
          actingFor,
        },
      });
    } catch (err) {
      const msg = `[Lelu] Authorization check failed for "${this.name}": ${String(err)}`;
      if (throwOnDeny) throw new Error(msg);
      return {
        allowed: false,
        output: msg,
        requiresHumanReview: false,
        reason: String(err),
      };
    }

    // Human review required — queue and return pending message.
    if (decision.requiresHumanReview) {
      const msg =
        `[Lelu] Action "${this.name}" is queued for human review. ` +
        `Reason: ${decision.reason}. Please wait for approval before proceeding.`;
      return {
        allowed: false,
        output: msg,
        requiresHumanReview: true,
        reason: decision.reason,
        ...(decision.reviewId !== undefined ? { reviewId: decision.reviewId } : {}),
      };
    }

    // Scope downgrade — `allowed` is true here, but the engine granted a
    // restricted scope (e.g. "read_only"), not the action as requested. This
    // wrapper has no way to re-run an arbitrary function under a restricted
    // scope, so it must never fall through to a full-scope execution here.
    if (decision.downgradedScope) {
      const msg =
        `[Lelu] Action "${this.name}" was downgraded to '${decision.downgradedScope}' scope. ` +
        `Reason: ${decision.reason}. The original tool was not run.`;
      return {
        allowed: false,
        output: msg,
        requiresHumanReview: false,
        reason: decision.reason,
      };
    }

    // Compute — the engine redirected to a safer alternative rather than
    // allowing this exact call. Surface it; never auto-run the original tool.
    if (decision.computed) {
      const msg =
        `[Lelu] Action "${this.name}" was redirected to a safe alternative` +
        `${decision.safeTool ? ` (${decision.safeTool})` : ""}. ` +
        `Reason: ${decision.reason}. The original tool was not run.`;
      return {
        allowed: false,
        output: msg,
        requiresHumanReview: false,
        reason: decision.reason,
      };
    }

    // Hard deny — return structured refusal.
    if (!decision.allowed) {
      const msg =
        `[Lelu] Action "${this.name}" was denied. ` +
        `Reason: ${decision.reason}. ` +
        `Downgraded scope: ${decision.downgradedScope ?? "none"}.`;
      return {
        allowed: false,
        output: msg,
        requiresHumanReview: false,
        reason: decision.reason,
      };
    }

    // Authorized — run the tool.
    const output = await func(input);
    return {
      allowed: true,
      output,
      requiresHumanReview: false,
      reason: decision.reason,
    };
  }
}
