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

// Mirrors the engine's POST /v1/agent/authorize response (agentAuthorizeResponse
// in engine/internal/server/server.go). The engine emits boolean flags — there is
// no top-level `decision` field; the SDK derives it from allowed/requires_human_review/compute.
function authorizeResponse(
  decision: "allow" | "deny" | "human_review" | "compute",
  reqId = "req-1"
) {
  return {
    allowed: decision === "allow",
    requires_human_review: decision === "human_review",
    compute: decision === "compute",
    reason: decision === "allow" ? "action allowed" : "action denied",
    trace_id: reqId,
    confidence_used: 0,
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

    it("returns compute decision with safeTool and safeArgs", async () => {
      mockOK({
        ...authorizeResponse("compute", "t-compute"),
        safe_tool: "fs.write_file",
        safe_args: { path: "/dev/sandbox/config.yaml" },
      });
      const dec = await client.authorize({
        tool: "fs.write_file",
        args: { path: "/prod/config.yaml" },
      });
      expect(dec.decision).toBe("compute");
      expect(dec.computed).toBe(true);
      expect(dec.allowed).toBe(false);
      expect(dec.safeTool).toBe("fs.write_file");
      expect(dec.safeArgs).toEqual({ path: "/dev/sandbox/config.yaml" });
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

    it("forwards the actor to the engine (agent_scopes selector)", async () => {
      mockOK(authorizeResponse("allow", "t-actor"));
      await client.agentAuthorize({
        actor: "invoice_bot",
        action: "approve_refunds",
        context: { confidence: 0.95 },
      });
      const body = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body);
      expect(body.actor).toBe("invoice_bot");
      expect(body.action).toBe("approve_refunds");
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

  // ── Engine policy ─────────────────────────────────────────────────────────

  describe("getEnginePolicy()", () => {
    it("returns policy digest info", async () => {
      mockOK({ digest: "sha256:abc", policy_path: "/etc/lelu/policy.yaml", source: "engine" });
      const info = await client.getEnginePolicy();
      expect(info.digest).toBe("sha256:abc");
      expect(info.source).toBe("engine");
    });
  });

  describe("validatePolicy()", () => {
    it("posts raw YAML and returns the validation result", async () => {
      mockOK({ valid: true, digest: "sha256:def" });
      const result = await client.validatePolicy("rules: []");
      expect(result.valid).toBe(true);

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:8080/v1/policy/validate");
      expect(init.method).toBe("POST");
      expect(init.headers["Content-Type"]).toBe("application/x-yaml");
      expect(init.body).toBe("rules: []");
    });

    it("surfaces validation failures", async () => {
      mockOK({ valid: false });
      const result = await client.validatePolicy("not: valid: yaml:");
      expect(result.valid).toBe(false);
    });
  });

  describe("putEnginePolicy()", () => {
    it("puts raw YAML with an If-Match header", async () => {
      mockOK({ digest: "sha256:new", previous_digest: "sha256:def" });
      const result = await client.putEnginePolicy("rules: []", "sha256:def");
      expect(result.digest).toBe("sha256:new");

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:8080/v1/policy");
      expect(init.method).toBe("PUT");
      expect(init.headers["If-Match"]).toBe("sha256:def");
    });

    it("omits If-Match when not provided", async () => {
      mockOK({ digest: "sha256:new" });
      await client.putEnginePolicy("rules: []");
      const [, init] = mockFetch.mock.calls[0];
      expect(init.headers["If-Match"]).toBeUndefined();
    });
  });
});
