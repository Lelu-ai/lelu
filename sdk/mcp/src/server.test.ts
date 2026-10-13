import { describe, it, expect } from "vitest";
import { agentDecisionStatus, formatAgentDecision, type EngineAgentDecision } from "./server.js";

const base: EngineAgentDecision = {
  allowed: false,
  reason: "r",
  trace_id: "t-1",
  requires_human_review: false,
  confidence_used: 0.9,
  provider_signal_present: false,
};

describe("agentDecisionStatus", () => {
  it("distinguishes compute from a plain allow", () => {
    expect(agentDecisionStatus({ ...base, allowed: true })).toBe("ALLOWED");
    expect(agentDecisionStatus({ ...base, allowed: true, compute: true })).toBe("COMPUTE");
  });

  it("reports review and deny", () => {
    expect(agentDecisionStatus({ ...base, requires_human_review: true })).toBe("REQUIRES_HUMAN_REVIEW");
    expect(agentDecisionStatus(base)).toBe("DENIED");
  });
});

describe("formatAgentDecision", () => {
  it("passes review_id through on human review", () => {
    const out = formatAgentDecision({ ...base, requires_human_review: true, review_id: "rev-1" });
    expect(out["review_id"]).toBe("rev-1");
    expect(out["trace_id"]).toBe("t-1");
  });

  it("passes compute, safe_tool and safe_args through", () => {
    const safe_args = { path: "/tmp/lelu-sandbox/{original}", sandboxed: true };
    const out = formatAgentDecision({ ...base, allowed: true, compute: true, safe_tool: "write_file", safe_args });
    expect(out).toMatchObject({ status: "COMPUTE", compute: true, safe_tool: "write_file", safe_args });
  });

  it("always reports provider_signal_present", () => {
    expect(formatAgentDecision({ ...base, provider_signal_present: undefined })["provider_signal_present"]).toBe(false);
    expect(formatAgentDecision({ ...base, provider_signal_present: true })["provider_signal_present"]).toBe(true);
  });

  it("omits review and compute fields when absent", () => {
    const out = formatAgentDecision({ ...base, allowed: true });
    expect(out).not.toHaveProperty("review_id");
    expect(out).not.toHaveProperty("compute");
    expect(out).not.toHaveProperty("safe_tool");
  });
});
