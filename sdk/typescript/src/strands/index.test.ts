/**
 * Tests for the Strands Agents integration.
 *
 * Strands is not a dependency of this package, so a plain object stands in for
 * BeforeToolCallEvent. That is enough: the adapter only ever touches toolUse
 * and cancel, and the part worth testing is the mapping from a Lelu decision
 * to a Strands outcome.
 */

import { describe, expect, it, vi } from "vitest";

/**
 * The runtime half of @strands-agents/sdk is mocked; the type half is not.
 *
 * `tsc` checks this integration against the real shipped .d.ts files, which is
 * what validates that we implement the base class correctly and return the
 * right action shapes. Loading the SDK at *runtime* additionally drags in its
 * tool machinery, which requires Zod v4 while this package pins ^3.23.0 — an
 * unrelated dependency conflict that would tell us nothing about our mapping.
 *
 * These stand-ins mirror the real action dataclasses exactly (see
 * interventions/actions.d.ts): plain objects with a `type` discriminator.
 */
vi.mock("@strands-agents/sdk", () => ({
  InterventionHandler: class {
    readonly onError = "throw";
  },
  InterventionActions: {
    proceed: (options?: { reason?: string }) => ({ type: "proceed", ...options }),
    deny: (reason: string) => ({ type: "deny", reason }),
    guide: (feedback: string, options?: { reason?: string }) => ({
      type: "guide",
      feedback,
      ...options,
    }),
    confirm: (prompt: string, options?: Record<string, unknown>) => ({
      type: "confirm",
      prompt,
      ...options,
    }),
    transform: (apply: (e: unknown) => void, options?: { reason?: string }) => ({
      type: "transform",
      apply,
      ...options,
    }),
  },
}));


/**
 * Strands' runtime is mocked, not its types.
 *
 * Importing the real @strands-agents/sdk at test time drags in its whole
 * module graph — MCP transport, zod-based tool schemas — and it targets zod 4
 * while this package is on zod 3. None of that is under test here: what is
 * under test is whether a Lelu decision produces the right Strands action.
 *
 * The stand-ins below mirror the real shapes exactly (plain objects with a
 * `type` discriminator, and an abstract base class). The guarantee that they
 * still match the real SDK comes from `tsc --noEmit`, which typechecks the
 * implementation against the genuine InterventionHandler signature.
 */
vi.mock("@strands-agents/sdk", () => ({
  InterventionHandler: class {
    readonly onError: string = "throw";
  },
  InterventionActions: {
    proceed: (options?: { reason?: string }) => ({ type: "proceed", ...options }),
    deny: (reason: string) => ({ type: "deny", reason }),
    guide: (feedback: string, options?: { reason?: string }) => ({ type: "guide", feedback, ...options }),
    confirm: (prompt: string, options?: { reason?: string }) => ({ type: "confirm", prompt, ...options }),
    transform: (apply: (e: unknown) => void, options?: { reason?: string }) => ({ type: "transform", apply, ...options }),
  },
}));

import type { AuthDecision } from "../types.js";
import { decide, extractCall, LeluIntervention, type GuardOutcome } from "./index.js";

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

/**
 * Stands in for BeforeToolCallEvent. Only toolUse is needed: the handler
 * returns actions rather than mutating the event, and the one mutation that
 * does happen (Transform) goes through the apply callback, exercised directly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function event(name = "refund", input: Record<string, unknown> = {}): any {
  return { toolUse: { name, input, toolUseId: "tu-1" } };
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

describe("extractCall", () => {
  it("reads the tool use", () => {
    expect(extractCall(event("refund", { amount: 10 }))).toEqual({
      name: "refund",
      arguments: { amount: 10 },
      toolUseId: "tu-1",
    });
  });

  it("survives a missing toolUse", () => {
    expect(extractCall({}).name).toBe("");
  });
});

// ── The guard ───────────────────────────────────────────────────────────────

function guardWith(d: AuthDecision | Error, opts: Record<string, unknown> = {}) {
  const client = {
    authorize: vi.fn(d instanceof Error ? () => Promise.reject(d) : () => Promise.resolve(d)),
    waitAndRedeem: vi.fn(() => Promise.resolve({ allowed: true, reason: "ok" })),
  };
  const silent = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const guard = new LeluIntervention({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: client as any,
    actor: "invoice_bot",
    logger: silent,
    ...opts,
  });
  return { guard, client };
}

describe("LeluIntervention", () => {
  it("exposes a name Strands can identify it by", () => {
    expect(guardWith(decision()).guard.name).toBe("lelu-authorization");
  });

  it("defaults to fail-closed on handler error", () => {
    // Strands defaults onError to 'throw'. A broken authorization check must
    // block the call, not surface as an unhandled error.
    expect(guardWith(decision()).guard.onError).toBe("deny");
  });

  it("returns proceed on allow", async () => {
    const { guard, client } = guardWith(decision());
    const action = await guard.beforeToolCall(event());
    expect(action.type).toBe("proceed");
    expect(client.authorize).toHaveBeenCalledOnce();
  });

  it("returns deny with the reason", async () => {
    const { guard } = guardWith(
      decision({ decision: "deny", allowed: false, reason: "destructive action" }),
    );
    const action = await guard.beforeToolCall(event());
    expect(action.type).toBe("deny");
    expect((action as { reason: string }).reason).toContain("destructive action");
  });

  it("returns a transform that re-points the call to the safe tool", async () => {
    const { guard } = guardWith(
      decision({
        decision: "compute",
        allowed: false,
        safeTool: "refund_sandbox",
        safeArgs: { dryRun: true },
      }),
    );
    const e = event();
    const action = await guard.beforeToolCall(e);
    expect(action.type).toBe("transform");

    // Strands calls apply() to mutate the event in place.
    (action as { apply: (ev: unknown) => void }).apply(e);
    expect(e.toolUse.name).toBe("refund_sandbox");
    expect(e.toolUse.input).toEqual({ dryRun: true });
  });

  it("returns confirm for human review by default", async () => {
    // Confirm pauses through Strands' interrupt system, which is the whole
    // reason human_review maps onto it rather than a plain denial.
    const { guard } = guardWith(
      decision({ decision: "human_review", allowed: false, reviewId: "rev-42" }),
    );
    const action = await guard.beforeToolCall(event());
    expect(action.type).toBe("confirm");
    expect((action as { prompt: string }).prompt).toContain("human approval");
  });

  it("can defer human review to Lelu's own queue instead", async () => {
    const { guard } = guardWith(
      decision({ decision: "human_review", allowed: false, reviewId: "rev-42" }),
      { onReview: "deny" },
    );
    expect((await guard.beforeToolCall(event())).type).toBe("deny");
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

  it("fails closed when the engine is unreachable", async () => {
    const { guard } = guardWith(new Error("connection refused"));
    const action = await guard.beforeToolCall(event());
    expect(action.type).toBe("deny");
    expect((action as { reason: string }).reason).toContain("unreachable");
  });

  it("fails open only when explicitly configured", async () => {
    const { guard } = guardWith(new Error("connection refused"), { failOpen: true });
    expect((await guard.beforeToolCall(event())).type).toBe("proceed");
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
