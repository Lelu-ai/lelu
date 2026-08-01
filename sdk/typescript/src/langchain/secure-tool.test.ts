import { describe, it, expect, vi, beforeEach } from "vitest";
import { SecureTool } from "./secure-tool.js";
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SecureTool", () => {
  const toolFn = vi.fn().mockResolvedValue("refund processed");

  beforeEach(() => {
    toolFn.mockClear();
  });

  it("runs the tool when allowed", async () => {
    const client = mockClient({ allowed: true });
    const tool = new SecureTool({
      name: "process_refund",
      description: "Processes a refund",
      actor: "invoice_bot",
      requiredPermission: "invoice:refund",
      client,
      func: toolFn,
    });

    const result = await tool.invoke("order_123");
    expect(result).toBe("refund processed");
    expect(toolFn).toHaveBeenCalledWith("order_123");
  });

  it("returns structured refusal when denied", async () => {
    const client = mockClient({ allowed: false, reason: "confidence too low" });
    const tool = new SecureTool({
      name: "process_refund",
      description: "Processes a refund",
      actor: "invoice_bot",
      requiredPermission: "invoice:refund",
      client,
      func: toolFn,
    });

    const result = await tool.invoke("order_123");
    expect(result).toContain("denied");
    expect(result).toContain("confidence too low");
    expect(toolFn).not.toHaveBeenCalled();
  });

  it("returns pending message when requires human review, and surfaces reviewId", async () => {
    const client = mockClient({
      allowed: false,
      requiresHumanReview: true,
      reason: "needs approval",
      reviewId: "rev-123",
    });
    const tool = new SecureTool({
      name: "process_refund",
      description: "Processes a refund",
      actor: "invoice_bot",
      requiredPermission: "invoice:refund",
      client,
      func: toolFn,
    });

    const result = await tool.checkAndCall("order_123");
    expect(result.output).toContain("queued for human review");
    expect(result.output).toContain("needs approval");
    expect(result.reviewId).toBe("rev-123");
    expect(toolFn).not.toHaveBeenCalled();
  });

  // `allowed: true` is also how the engine represents a scope downgrade or a
  // compute redirect — neither means "run the tool as requested." A wrapper
  // that branches only on `allowed` would run the tool at full, unrestricted
  // scope in both cases. This is the invariant that matters most: for every
  // outcome other than a clean allow, the wrapped function must never run.
  it("does NOT run the tool when the engine downgrades the scope", async () => {
    const client = mockClient({
      allowed: true,
      downgradedScope: "read_only",
      reason: "confidence below full-permission threshold",
    });
    const tool = new SecureTool({
      name: "process_refund",
      description: "Processes a refund",
      actor: "invoice_bot",
      requiredPermission: "invoice:refund",
      client,
      func: toolFn,
    });

    const result = await tool.invoke("order_123");
    expect(result).toContain("downgraded");
    expect(result).toContain("read_only");
    expect(toolFn).not.toHaveBeenCalled();
  });

  it("does NOT run the tool when the engine redirects to a compute alternative", async () => {
    const client = mockClient({
      allowed: true,
      computed: true,
      safeTool: "process_refund_sandbox",
      reason: "redirected to sandbox",
    });
    const tool = new SecureTool({
      name: "process_refund",
      description: "Processes a refund",
      actor: "invoice_bot",
      requiredPermission: "invoice:refund",
      client,
      func: toolFn,
    });

    const result = await tool.invoke("order_123");
    expect(result).toContain("redirected");
    expect(result).toContain("process_refund_sandbox");
    expect(toolFn).not.toHaveBeenCalled();
  });

  it("throws when denied and throwOnDeny=true", async () => {
    const client = mockClient({ allowed: false, reason: "hard deny" });
    const tool = new SecureTool({
      name: "process_refund",
      description: "Processes a refund",
      actor: "invoice_bot",
      requiredPermission: "invoice:refund",
      client,
      func: toolFn,
      throwOnDeny: true,
    });

    await expect(tool.invoke("order_123")).rejects.toThrow(/hard deny/);
    expect(toolFn).not.toHaveBeenCalled();
  });

  it("exposes name and description for LangChain", () => {
    const tool = new SecureTool({
      name: "my_tool",
      description: "A secure tool",
      actor: "bot",
      requiredPermission: "do:thing",
      client: mockClient({}),
      func: toolFn,
    });
    expect(tool.name).toBe("my_tool");
    expect(tool.description).toBe("A secure tool");
  });

  it("call() is an alias for invoke()", async () => {
    const client = mockClient({ allowed: true });
    const tool = new SecureTool({
      name: "t",
      description: "d",
      actor: "bot",
      requiredPermission: "x",
      client,
      func: toolFn,
    });
    const r1 = await tool.invoke("input");
    const r2 = await tool.call("input");
    expect(r1).toBe(r2);
  });
});
