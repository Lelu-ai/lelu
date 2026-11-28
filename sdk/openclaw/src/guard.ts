// Turns a rule match into OpenClaw's before_tool_call answer:
//   no match  -> nothing (no decision; the call goes ahead)
//   deny      -> { block: true, blockReason }
//   review    -> { requireApproval: ... } (OpenClaw pauses and asks the user)
// Any unexpected error blocks the call: a guard that fails open is no guard.

import { activeRules, type LeluPluginConfig } from "./config.js";
import { commandText, compileRules, evaluate, pathsOf, type Match, type ToolCall } from "./rules.js";

export const PLUGIN_ID = "lelu";

export interface ToolCallEvent {
  toolName: string;
  params?: Record<string, unknown>;
  derivedPaths?: readonly string[];
}

export type ApprovalDecision = "allow-once" | "allow-always" | "deny" | "timeout" | "cancelled";

export interface GuardResult {
  block?: boolean;
  blockReason?: string;
  requireApproval?: {
    title: string;
    description: string;
    severity: "info" | "warning" | "critical";
    timeoutMs: number;
    allowedDecisions: Array<"allow-once" | "allow-always" | "deny">;
    onResolution?: (decision: ApprovalDecision) => void;
  };
}

export interface GuardOptions {
  /** Called once per decision Lelu makes, for logging. */
  onDecision?: (event: { toolName: string; verdict: Match["verdict"] | "error"; ruleId?: string; reason: string }) => void;
  /** Called with the user's answer to an approval request. */
  onApproval?: (event: { toolName: string; ruleId: string; decision: ApprovalDecision }) => void;
}

const PREVIEW_CHARS = 400;

/** What the call will do, shortened for the approval prompt. */
export function preview(call: ToolCall): string {
  const text = commandText(call.params) || pathsOf(call).join(", ");
  if (!text) return call.toolName;
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > PREVIEW_CHARS ? `${oneLine.slice(0, PREVIEW_CHARS)}…` : oneLine;
}

/** Builds the before_tool_call handler. Throws if a configured rule is invalid. */
export function createToolGuard(config: LeluPluginConfig, options: GuardOptions = {}) {
  const rules = compileRules(activeRules(config));
  const timeoutMs = config.approvalTimeoutSeconds * 1000;

  return function beforeToolCall(event: ToolCallEvent): GuardResult | undefined {
    const toolName = typeof event?.toolName === "string" ? event.toolName : "";
    try {
      const call: ToolCall = {
        toolName,
        params: event?.params && typeof event.params === "object" ? event.params : {},
        derivedPaths: Array.isArray(event?.derivedPaths) ? event.derivedPaths : undefined,
      };
      const match = evaluate(rules, call);
      if (!match) return undefined;

      const { rule } = match;
      options.onDecision?.({ toolName, verdict: match.verdict, ruleId: rule.id, reason: rule.reason });

      if (match.verdict === "deny") {
        return {
          block: true,
          blockReason: `Blocked by Lelu (${rule.id}): ${rule.reason}. To allow it, add "${rule.id}" to disableRules in the lelu plugin config.`,
        };
      }

      return {
        requireApproval: {
          title: `Lelu: ${rule.reason}`,
          description: `${toolName}: ${preview(call)}\n\nRule ${rule.id}. Approve only if you expected the agent to do this.`,
          severity: "warning",
          timeoutMs,
          allowedDecisions: ["allow-once", "deny"],
          onResolution: (decision) => options.onApproval?.({ toolName, ruleId: rule.id, decision }),
        },
      };
    } catch (err) {
      const reason = `Lelu could not check this call (${(err as Error)?.message ?? "unknown error"}), so it was blocked`;
      try {
        options.onDecision?.({ toolName, verdict: "error", reason });
      } catch {
        // Logging must never turn a block into a crash.
      }
      return { block: true, blockReason: reason };
    }
  };
}
