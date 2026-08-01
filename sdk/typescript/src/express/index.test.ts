import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { authorize } from "./index.js";

// ─── Mock fetch globally ───────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mirrors the engine's POST /v1/agent/authorize response shape.
function mockAgentAuthorizeResponse(body: Record<string, unknown>) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({
      allowed: false,
      requires_human_review: false,
      compute: false,
      reason: "ok",
      trace_id: "req-test",
      confidence_used: 0.9,
      ...body,
    }),
  });
}

function mockReq(): Request {
  return { headers: {} } as unknown as Request;
}

function mockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

// ─────────────────────────────────────────────────────────────────────────────

describe("authorize() express middleware", () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
  });

  it("calls next() on a clean allow", async () => {
    mockAgentAuthorizeResponse({ allowed: true, reason: "action authorized" });
    const req = mockReq();
    const res = mockRes();

    await authorize("invoice:refund", { baseUrl: "http://localhost:8080" })(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 403 on a hard deny, without calling next()", async () => {
    mockAgentAuthorizeResponse({ allowed: false, reason: "policy denied" });
    const req = mockReq();
    const res = mockRes();

    await authorize("invoice:refund", { baseUrl: "http://localhost:8080" })(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  // The engine represents a scope downgrade or a compute redirect with
  // `allowed: true` too — neither means "let the route handler run
  // unrestricted." Middleware that calls next() on `allowed` alone would let
  // the full, unrestricted route run in both cases.
  it("returns 403 on a scope downgrade, without calling next()", async () => {
    mockAgentAuthorizeResponse({
      allowed: true,
      downgraded_scope: "read_only",
      reason: "confidence below full-permission threshold",
    });
    const req = mockReq();
    const res = mockRes();

    await authorize("invoice:refund", { baseUrl: "http://localhost:8080" })(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ downgradedScope: "read_only" })
    );
  });

  it("returns 403 on a compute redirect, without calling next()", async () => {
    mockAgentAuthorizeResponse({
      allowed: true,
      compute: true,
      safe_tool: "invoice_refund_sandbox",
      reason: "redirected to sandbox",
    });
    const req = mockReq();
    const res = mockRes();

    await authorize("invoice:refund", { baseUrl: "http://localhost:8080" })(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
