import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  secureNode,
  wasDenied,
  pendingReview,
  denialReason,
  LeluDeniedError,
} from "./secure-node.js";
import type { LeluClient } from "../client.js";
import type { AgentAuthDecision } from "../types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockClient(decision: Partial<AgentAuthDecision>): LeluClient {
  const full: AgentAuthDecision = {
    allowed: true,
    reason: "ok",
    traceId: "trace-1",
    requiresHumanReview: false,
    confidenceUsed: 0.95,
    downgradedScope: undefined,
    ...decision,
  };
  return {
    agentAuthorize: vi.fn().mockResolvedValue(full),
  } as unknown as LeluClient;
}

interface TestState extends Record<string, unknown> {
  confidence?: number;
  userId?: string;
  approved?: boolean;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("secureNode", () => {
  const nodeFn = vi.fn(async (state: TestState) => ({ approved: true }));

  beforeEach(() => {
    nodeFn.mockClear();
  });

  it("runs the wrapped node when allowed", async () => {
    const client = mockClient({ allowed: true });
    const node = secureNode<TestState>(
      { client, actor: "invoice_bot", action: "invoice:approve" },
      nodeFn
    );

    const result = await node({ confidence: 0.9 });
    expect(result.approved).toBe(true);
    expect(result.leluDenied).toBe(false);
    expect(nodeFn).toHaveBeenCalledWith({ confidence: 0.9 });
  });

  it("forwards the confidence and actingFor state keys", async () => {
    const client = mockClient({ allowed: true });
    const node = secureNode<TestState>(
      {
        client,
        actor: "invoice_bot",
        action: "invoice:approve",
        actingForKey: "userId",
      },
      nodeFn
    );

    await node({ confidence: 0.7, userId: "user-42" });
    expect(client.agentAuthorize).toHaveBeenCalledWith({
      actor: "invoice_bot",
      action: "invoice:approve",
      context: { confidence: 0.7, actingFor: "user-42" },
    });
  });

  it("returns pending-review state without running the node", async () => {
    const client = mockClient({
      allowed: false,
      requiresHumanReview: true,
      reason: "confidence below threshold",
    });
    const node = secureNode<TestState>(
      { client, actor: "invoice_bot", action: "invoice:approve" },
      nodeFn
    );

    const result = await node({ confidence: 0.5 });
    expect(wasDenied(result)).toBe(true);
    expect(pendingReview(result)).toBe(true);
    expect(denialReason(result)).toBe("confidence below threshold");
    expect(nodeFn).not.toHaveBeenCalled();
  });

  it("returns denied state without running the node", async () => {
    const client = mockClient({ allowed: false, reason: "policy denied" });
    const node = secureNode<TestState>(
      { client, actor: "invoice_bot", action: "invoice:approve" },
      nodeFn
    );

    const result = await node({ confidence: 0.2 });
    expect(wasDenied(result)).toBe(true);
    expect(pendingReview(result)).toBe(false);
    expect(denialReason(result)).toBe("policy denied");
    expect(nodeFn).not.toHaveBeenCalled();
  });

  it("throws LeluDeniedError when throwOnDeny is set", async () => {
    const client = mockClient({ allowed: false, reason: "policy denied" });
    const node = secureNode<TestState>(
      {
        client,
        actor: "invoice_bot",
        action: "invoice:approve",
        throwOnDeny: true,
      },
      nodeFn
    );

    await expect(node({ confidence: 0.2 })).rejects.toThrow(LeluDeniedError);
  });

  it("uses defaultConfidence when the state key is absent", async () => {
    const client = mockClient({ allowed: true });
    const node = secureNode<TestState>(
      { client, actor: "invoice_bot", action: "invoice:approve", defaultConfidence: 0.6 },
      nodeFn
    );

    await node({});
    expect(client.agentAuthorize).toHaveBeenCalledWith({
      actor: "invoice_bot",
      action: "invoice:approve",
      context: { confidence: 0.6 },
    });
  });
});
