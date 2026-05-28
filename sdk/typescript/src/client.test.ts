import { describe, it, expect, vi, beforeEach } from "vitest";
import { LeluClient, AuthEngineError } from "../src/index.js";

// ── Mock fetch globally ────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockOK(body: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => body,
  });
}

function mockError(status: number, errorMsg: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ error: errorMsg }),
  });
}

function authorizeResponse(decision: "allow" | "deny" | "human_review", reqId = "req-1") {
  return {
    requestId: reqId,
    tool: "test_tool",
    decision,
    reason: decision === "allow" ? "action allowed" : "action denied",
    rule: "default",
    latencyMs: 1.5,
    mode: "live",
    timestamp: "2024-01-01T00:00:00Z",
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("LeluClient", () => {
  let client: LeluClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new LeluClient({ baseUrl: "http://localhost:8080" });
  });

  // ── authorize ──────────────────────────────────────────────────────────────

  describe("authorize()", () => {
    it("returns allowed decision", async () => {
      mockOK(authorizeResponse("allow", "t1"));
      const dec = await client.authorize({ tool: "approve_refunds" });
      expect(dec.allowed).toBe(true);
      expect(dec.requestId).toBe("t1");
    });

    it("returns denied decision", async () => {
      mockOK(authorizeResponse("deny", "t2"));
      const dec = await client.authorize({ tool: "delete_invoices" });
      expect(dec.allowed).toBe(false);
    });

    it("returns human_review decision", async () => {
      mockOK(authorizeResponse("human_review", "t3"));
      const dec = await client.authorize({ tool: "wire_transfer" });
      expect(dec.allowed).toBe(false);
      expect(dec.decision).toBe("human_review");
    });

    it("throws AuthEngineError on HTTP error", async () => {
      mockError(500, "internal error");
      await expect(
        client.authorize({ tool: "approve_refunds" })
      ).rejects.toBeInstanceOf(AuthEngineError);
    });

    it("throws Zod validation error on missing tool", async () => {
      await expect(
        // @ts-expect-error – intentional bad input
        client.authorize({ action: "approve_refunds" })
      ).rejects.toThrow();
    });
  });

  // ── agentAuthorize ────────────────────────────────────────────────────────

  describe("agentAuthorize()", () => {
    it("returns allowed with full confidence", async () => {
      mockOK(authorizeResponse("allow", "t4"));
      const dec = await client.agentAuthorize({
        actor: "invoice_bot",
        action: "approve_refunds",
        context: { confidence: 0.95, actingFor: "user_123" },
      });
      expect(dec.allowed).toBe(true);
      expect(dec.requiresHumanReview).toBe(false);
      expect(dec.confidenceUsed).toBe(0.95);
    });

    it("returns requires_human_review at 0.80 confidence", async () => {
      mockOK(authorizeResponse("human_review", "t5"));
      const dec = await client.agentAuthorize({
        actor: "invoice_bot",
        action: "approve_refunds",
        context: { confidence: 0.80 },
      });
      expect(dec.requiresHumanReview).toBe(true);
      expect(dec.allowed).toBe(false);
    });

    it("returns denied decision at low confidence", async () => {
      mockOK(authorizeResponse("deny", "t6"));
      const dec = await client.agentAuthorize({
        actor: "invoice_bot",
        action: "approve_refunds",
        context: { confidence: 0.65 },
      });
      expect(dec.allowed).toBe(false);
      expect(dec.requiresHumanReview).toBe(false);
      expect(dec.traceId).toBe("t6");
    });

    it("validates confidence is between 0 and 1", async () => {
      await expect(
        client.agentAuthorize({
          actor: "bot",
          action: "act",
          context: { confidence: 1.5 },
        })
      ).rejects.toThrow();
    });
  });

  // ── mintToken ─────────────────────────────────────────────────────────────

  describe("mintToken()", () => {
    it("returns minted token", async () => {
      const expiresAt = Math.floor(Date.now() / 1000) + 60;
      mockOK({ token: "jwt.token.here", token_id: "tid1", expires_at: expiresAt });

      const result = await client.mintToken({ scope: "invoice_bot", actingFor: "user_123" });
      expect(result.token).toBe("jwt.token.here");
      expect(result.tokenId).toBe("tid1");
      expect(result.expiresAt).toBeInstanceOf(Date);
    });
  });

  // ── revokeToken ───────────────────────────────────────────────────────────

  describe("revokeToken()", () => {
    it("returns success on revoke", async () => {
      mockOK({ success: true });
      const result = await client.revokeToken("tid1");
      expect(result.success).toBe(true);
    });
  });

  // ── delegateScope ────────────────────────────────────────────────────────

  describe("delegateScope()", () => {
    it("returns delegated token payload", async () => {
      const expiresAt = Math.floor(Date.now() / 1000) + 120;
      mockOK({
        token: "child.jwt.token",
        token_id: "dtid1",
        expires_at: expiresAt,
        delegator: "orchestrator_agent",
        delegatee: "research_agent",
        granted_scopes: ["research"],
        trace_id: "td1",
      });

      const result = await client.delegateScope({
        delegator: "orchestrator_agent",
        delegatee: "research_agent",
        scopedTo: ["research"],
        confidence: 0.92,
      });

      expect(result.token).toBe("child.jwt.token");
      expect(result.tokenId).toBe("dtid1");
      expect(result.grantedScopes).toEqual(["research"]);
      expect(result.traceId).toBe("td1");
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it("validates confidence is between 0 and 1", async () => {
      await expect(
        client.delegateScope({
          delegator: "orchestrator_agent",
          delegatee: "research_agent",
          confidence: 1.1,
        })
      ).rejects.toThrow();
    });
  });

  // ── isHealthy ─────────────────────────────────────────────────────────────

  describe("isHealthy()", () => {
    it("returns true on ok status", async () => {
      mockOK({ status: "ok" });
      expect(await client.isHealthy()).toBe(true);
    });

    it("returns false when fetch throws", async () => {
      mockFetch.mockRejectedValueOnce(new Error("connection refused"));
      expect(await client.isHealthy()).toBe(false);
    });
  });
});
