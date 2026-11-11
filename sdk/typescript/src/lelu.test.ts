import { describe, it, expect, vi, beforeEach } from "vitest";
import { lelu, LeluClient } from "../src/index.js";

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

function mockEngineError(status: number, errorMsg: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ error: errorMsg }),
  });
}

// Mirrors the engine's POST /v1/agent/authorize response shape.
function authorizeResponse(allowed: boolean, reqId = "req-1") {
  return {
    allowed,
    requires_human_review: false,
    compute: false,
    reason: allowed ? "action allowed" : "action denied",
    trace_id: reqId,
    confidence_used: 0,
  };
}

function sentBody(callIndex = 0): Record<string, unknown> {
  const init = mockFetch.mock.calls[callIndex]?.[1] as { body: string };
  return JSON.parse(init.body);
}

// ─────────────────────────────────────────────────────────────────────────────

describe("lelu() factory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes the full client as .api", () => {
    const auth = lelu({ baseUrl: "http://localhost:8080" });
    expect(auth.api).toBeInstanceOf(LeluClient);
  });

  it("keeps the options it was created with", () => {
    const auth = lelu({ baseUrl: "http://localhost:8080", actor: "billing-agent" });
    expect(auth.options.actor).toBe("billing-agent");
  });

  describe("authorize()", () => {
    it("fills in the default actor when the request omits one", async () => {
      mockOK(authorizeResponse(true));
      const auth = lelu({ baseUrl: "http://localhost:8080", actor: "billing-agent" });

      const dec = await auth.authorize({ tool: "refund:process" });

      expect(dec.allowed).toBe(true);
      expect(sentBody().actor).toBe("billing-agent");
    });

    it("lets an explicit actor win over the default", async () => {
      mockOK(authorizeResponse(true));
      const auth = lelu({ baseUrl: "http://localhost:8080", actor: "billing-agent" });

      await auth.authorize({ tool: "refund:process", actor: "support-agent" });

      expect(sentBody().actor).toBe("support-agent");
    });

    it("sends no actor when neither default nor request provides one", async () => {
      mockOK(authorizeResponse(true));
      const auth = lelu({ baseUrl: "http://localhost:8080" });

      await auth.authorize({ tool: "refund:process" });

      expect(sentBody().actor).toBeUndefined();
    });
  });

  describe("handler()", () => {
    const base = "http://localhost:3000/api/lelu";

    function post(path: string, body: unknown, headers: Record<string, string> = {}): Request {
      return new Request(`${base}${path}`, {
        method: "POST",
        body: JSON.stringify(body),
        headers,
      });
    }

    // Stands in for an app's session check: the x-test-user header names the
    // caller, and "alice" is a reviewer.
    const authenticate = (request: Request) => {
      const user = request.headers.get("x-test-user");
      if (!user) return null;
      return user === "alice" ? { reviewer: "alice" } : {};
    };
    const asAlice = { "x-test-user": "alice" };

    it("routes POST /authorize to the engine and returns the decision", async () => {
      mockOK(authorizeResponse(true, "t-handler"));
      const auth = lelu({ baseUrl: "http://localhost:8080", actor: "billing-agent", authenticate });

      const res = await auth.handler(post("/authorize", { tool: "refund:process" }, { "x-test-user": "bob" }));
      const decision = await res.json();

      expect(res.status).toBe(200);
      expect(decision.allowed).toBe(true);
      expect(decision.requestId).toBe("t-handler");
      // Default actor applies through the handler too.
      expect(sentBody().actor).toBe("billing-agent");
    });

    it("routes GET /queue to the engine", async () => {
      mockOK({ items: [], count: 0 });
      const auth = lelu({ baseUrl: "http://localhost:8080", authenticate });

      const res = await auth.handler(new Request(`${base}/queue`, { headers: asAlice }));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ items: [], count: 0 });
    });

    it("routes POST /queue/:id/approve to the engine as the authenticated reviewer", async () => {
      mockOK({ success: true });
      const auth = lelu({ baseUrl: "http://localhost:8080", authenticate });

      const res = await auth.handler(
        post("/queue/item-1/approve", { resolvedBy: "mallory", note: "ok" }, asAlice)
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
      const engineUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(engineUrl).toContain("/item-1/");
      // The body's resolvedBy is ignored; the resolver is the authenticated caller.
      expect(sentBody()).toEqual({ resolved_by: "alice", note: "ok" });
    });

    it("sends the reviewer key when resolving", async () => {
      mockOK({ success: true });
      const auth = lelu({ baseUrl: "http://localhost:8080", authenticate, reviewerKey: "rk-secret-0123456789" });

      await auth.handler(post("/queue/item-1/deny", {}, asAlice));

      const init = mockFetch.mock.calls[0]?.[1] as { headers: Record<string, string> };
      expect(init.headers["X-Lelu-Reviewer-Key"]).toBe("rk-secret-0123456789");
    });

    // Reported in the Nauro pilot (L-2): the handler served every route to
    // any caller and let the body name the reviewer.
    describe("access", () => {
      it("refuses everything but /ok when no authenticate option is set", async () => {
        const auth = lelu({ baseUrl: "http://localhost:8080" });

        for (const req of [
          post("/authorize", { tool: "refund:process" }),
          new Request(`${base}/queue`),
          post("/queue/item-1/approve", { resolvedBy: "alice" }),
          post("/queue/item-1/deny", { resolvedBy: "alice" }),
        ]) {
          const res = await auth.handler(req);
          expect(res.status).toBe(403);
          expect((await res.json()).error).toBe("handler_not_configured");
        }
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it("returns 401 when authenticate refuses the caller", async () => {
        const auth = lelu({ baseUrl: "http://localhost:8080", authenticate });

        const res = await auth.handler(post("/queue/item-1/approve", { resolvedBy: "alice" }));

        expect(res.status).toBe(401);
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it("keeps a caller who is not a reviewer out of the queue", async () => {
        const auth = lelu({ baseUrl: "http://localhost:8080", authenticate });
        const bob = { "x-test-user": "bob" };

        expect((await auth.handler(new Request(`${base}/queue`, { headers: bob }))).status).toBe(403);
        expect((await auth.handler(post("/queue/item-1/approve", {}, bob))).status).toBe(403);
        expect((await auth.handler(post("/queue/item-1/deny", {}, bob))).status).toBe(403);
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it("accepts an async authenticate", async () => {
        mockOK({ items: [], count: 0 });
        const auth = lelu({
          baseUrl: "http://localhost:8080",
          authenticate: async () => ({ reviewer: "alice" }),
        });

        expect((await auth.handler(new Request(`${base}/queue`))).status).toBe(200);
      });
    });

    it("routes GET /ok to the health check", async () => {
      mockOK({ status: "ok" });
      const auth = lelu({ baseUrl: "http://localhost:8080" });

      const res = await auth.handler(new Request(`${base}/ok`));

      expect(await res.json()).toEqual({ ok: true });
    });

    it("returns 404 for unknown routes", async () => {
      const auth = lelu({ baseUrl: "http://localhost:8080", authenticate });

      const res = await auth.handler(new Request(`${base}/nope`, { headers: asAlice }));

      expect(res.status).toBe(404);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns 404 for paths outside basePath", async () => {
      const auth = lelu({ baseUrl: "http://localhost:8080" });

      const res = await auth.handler(
        new Request("http://localhost:3000/other/authorize", { method: "POST", body: "{}" })
      );

      expect(res.status).toBe(404);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("respects a custom basePath", async () => {
      mockOK({ status: "ok" });
      const auth = lelu({ baseUrl: "http://localhost:8080", basePath: "/auth/agent" });

      const res = await auth.handler(new Request("http://localhost:3000/auth/agent/ok"));

      expect(await res.json()).toEqual({ ok: true });
    });

    it("maps engine errors to the error status", async () => {
      mockEngineError(403, "denied by policy");
      const auth = lelu({ baseUrl: "http://localhost:8080", authenticate });

      const res = await auth.handler(post("/authorize", { tool: "refund:process" }, asAlice));

      expect(res.status).toBe(403);
    });
  });
});
