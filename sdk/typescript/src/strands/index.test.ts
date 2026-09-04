/**
 * Tests for the Strands Agents integration.
 *
 * Strands is not a dependency of this package, so a plain object stands in for
 * BeforeToolCallEvent. That is enough: the adapter only ever touches toolUse
 * and cancel, and the part worth testing is the mapping from a Lelu decision
 * to a Strands outcome.
 */

import { describe, expect, it, vi } from "vitest";
import type { AuthDecision } from "../types.js";
import {
  applyOutcome,
  decide,
  extractCall,
  LeluGuard,
  LeluPermissionDeniedError,
  type BeforeToolCallEventLike,
  type GuardOutcome,
} from "./index.js";

function decision(overrides: Partial<AuthDecision> = {}): AuthDecision {
  return {
    requestId: "req-1",
    tool: "refund",
    decision: "allow",
    reason: "policy allows",
    rule: "r1",
    latencyMs: 1,
    mode: "live",
    timestamp: "2026-09-04T00:00:00Z",
    allowed: true,
    ...overrides,
  } as AuthDecision;
}

function event(name = "refund", input: Record<string, unknown> = {}): BeforeToolCallEventLike {
  return { toolUse: { name, input, toolUseId: "tu-1" }, cancel: undefined };
}

const call = { name: "refund", arguments: {}, toolUseId: "tu-1" };

// ── The decision mapping ────────────────────────────────────────────────────

describe("decide", () => {
  it("lets an allowed call through", () => {
    expect(decide(decision(), call, "invoice_bot").action).toBe("allow");
  });

  it("denies and keeps the reason", () => {
    const out = decide(
      decision({ decision: "deny", allowed: false, reason: "destructive action" }),
      call,
      "invoice_bot",
    );
    expect(out.action).toBe("deny");
    expect(out.message).toContain("destructive action");
    expect(out.message).toContain("invoice_bot");
  });

  it("redirects a compute decision to the safe tool", () => {
    const out = decide(
      decision({
        decision: "compute",
        allowed: false,
        safeTool: "refund_sandbox",
        safeArgs: { dryRun: true },
      }),
      call,
      "invoice_bot",
    );
    expect(out.action).toBe("redirect");
    expect(out.replacementTool).toBe("refund_sandbox");
    expect(out.replacementArgs).toEqual({ dryRun: true });
  });

  it("checks compute before allowed, so a redirect is not read as a denial", () => {
    const out = decide(
      decision({ decision: "compute", allowed: false, safeTool: "safe" }),
      call,
      "bot",
    );
    expect(out.action).toBe("redirect");
  });

  it("carries the reviewId, without which a pending item is unreachable", () => {
    const out = decide(
      decision({ decision: "human_review", allowed: false, reviewId: "rev-42" }),
      call,
      "bot",
    );
    expect(out.action).toBe("review");
    expect(out.reviewId).toBe("rev-42");
  });
});

// ── The adapter ─────────────────────────────────────────────────────────────

describe("extractCall / applyOutcome", () => {
  it("reads the tool use", () => {
    const c = extractCall(event("refund", { amount: 10 }));
    expect(c).toEqual({ name: "refund", arguments: { amount: 10 }, toolUseId: "tu-1" });
  });

  it("survives a missing toolUse", () => {
    expect(extractCall({}).name).toBe("");
  });

  it("changes nothing on allow", () => {
    const e = event();
    applyOutcome(e, { action: "allow", message: "", reason: "", traceId: "" });
    expect(e.cancel).toBeUndefined();
    expect(e.toolUse?.name).toBe("refund");
  });

  it("cancels on deny", () => {
    const e = event();
    applyOutcome(e, { action: "deny", message: "blocked", reason: "", traceId: "" });
    expect(e.cancel).toBe("blocked");
  });

  it("renames on redirect so Strands re-resolves from its own registry", () => {
    const e = event();
    applyOutcome(e, {
      action: "redirect",
      message: "",
      reason: "",
      traceId: "",
      replacementTool: "refund_sandbox",
      replacementArgs: { dryRun: true },
    });
    expect(e.toolUse?.name).toBe("refund_sandbox");
    expect(e.toolUse?.input).toEqual({ dryRun: true });
    expect(e.cancel).toBeUndefined();
  });

  it("cancels when a redirect cannot be applied, rather than running the original", () => {
    const e: BeforeToolCallEventLike = { cancel: undefined };
    applyOutcome(e, {
      action: "redirect",
      message: "redirect failed",
      reason: "",
      traceId: "",
      replacementTool: "safe",
    });
    expect(e.cancel).toBe("redirect failed");
  });
});

// ── The guard ───────────────────────────────────────────────────────────────

function guardWith(d: AuthDecision | Error, opts: Record<string, unknown> = {}) {
  const client = {
    authorize: vi.fn(d instanceof Error ? () => Promise.reject(d) : () => Promise.resolve(d)),
    waitAndRedeem: vi.fn(() => Promise.resolve({ allowed: true, reason: "ok" })),
  };
  const silent = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const guard = new LeluGuard({ client: client as any, actor: "invoice_bot", logger: silent, ...opts });
  return { guard, client };
}

describe("LeluGuard", () => {
  it("authorizes and allows", async () => {
    const { guard, client } = guardWith(decision());
    const e = event();
    await guard.beforeToolCall(e);
    expect(e.cancel).toBeUndefined();
    expect(client.authorize).toHaveBeenCalledOnce();
  });

  it("sends the tool name as the action by default", async () => {
    const { guard, client } = guardWith(decision());
    await guard.beforeToolCall(event("refund"));
    const sent = client.authorize.mock.calls[0]![0] as { tool: string; actor: string };
    expect(sent.tool).toBe("refund");
    expect(sent.actor).toBe("invoice_bot");
  });

  it("honours a custom action mapping", async () => {
    const { guard, client } = guardWith(decision(), {
      actionFor: (c: { name: string }) => `tool:${c.name}`,
    });
    await guard.beforeToolCall(event("refund"));
    expect((client.authorize.mock.calls[0]![0] as { tool: string }).tool).toBe("tool:refund");
  });

  it("omits confidence when none is supplied, leaving MissingSignalMode to decide", async () => {
    const { guard, client } = guardWith(decision());
    await guard.beforeToolCall(event());
    const sent = client.authorize.mock.calls[0]![0] as { context: Record<string, unknown> };
    expect(sent.context.confidence).toBeUndefined();
  });

  it("cancels on deny", async () => {
    const { guard } = guardWith(decision({ decision: "deny", allowed: false, reason: "nope" }));
    const e = event();
    await guard.beforeToolCall(e);
    expect(String(e.cancel)).toContain("nope");
  });

  it("throws on deny when asked", async () => {
    const { guard } = guardWith(
      decision({ decision: "deny", allowed: false, reason: "nope" }),
      { throwOnDeny: true },
    );
    await expect(guard.beforeToolCall(event())).rejects.toBeInstanceOf(LeluPermissionDeniedError);
  });

  it("fails closed when the engine is unreachable", async () => {
    const { guard } = guardWith(new Error("connection refused"));
    const e = event();
    await guard.beforeToolCall(e);
    expect(String(e.cancel)).toContain("unreachable");
  });

  it("fails open only when explicitly configured", async () => {
    const { guard } = guardWith(new Error("connection refused"), { failOpen: true });
    const e = event();
    await guard.beforeToolCall(e);
    expect(e.cancel).toBeUndefined();
  });

  it("redeems using the request that was actually paused", async () => {
    const d = decision({ decision: "human_review", allowed: false, reviewId: "rev-42" });
    const { guard, client } = guardWith(d);

    const outcome = await guard.evaluate({ name: "refund", arguments: { amount: 10 }, toolUseId: "t" });
    expect(outcome.action).toBe("review");

    await guard.redeem(outcome);
    const [passedDecision, passedRequest] = client.waitAndRedeem.mock.calls[0]!;
    expect(passedDecision).toBe(d);
    expect(passedRequest).toBe(outcome.request);
  });

  it("refuses to redeem an outcome with nothing to redeem", async () => {
    const { guard } = guardWith(decision());
    const bare: GuardOutcome = { action: "deny", message: "", reason: "", traceId: "" };
    await expect(guard.redeem(bare)).rejects.toThrow(/no request to redeem/);
  });
});
