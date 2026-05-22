export default function DocsGuidesTesting() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 text-sm font-medium mb-6">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Guides
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">
          Testing Policies
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Learn how to unit-test your OPA policies with the built-in Rego test runner, write
          integration tests against a local Engine, and mock Lelu in application tests.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            1. Unit Testing with OPA
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            OPA ships a built-in test runner. Place test files alongside your policy with a{" "}
            <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">
              _test
            </code>{" "}
            suffix.
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden mb-4">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">policy/auth_test.rego</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`package lelu.authz_test

import data.lelu.authz

# High confidence → auto-allow
test_high_confidence_allow {
  authz.allow with input as {
    "confidence": 0.95,
    "action": "send_email"
  }
}

# Low confidence → deny
test_low_confidence_deny {
  not authz.allow with input as {
    "confidence": 0.3,
    "action": "send_email"
  }
}

# Medium confidence → require review
test_medium_review {
  authz.require_review with input as {
    "confidence": 0.7,
    "action": "send_email"
  }
}`}</pre>
          </div>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">terminal</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300">{`opa test ./policy/ -v`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            2. Integration Tests with a Local Engine
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Spin up a local Engine with{" "}
            <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">
              docker compose
            </code>{" "}
            and run against it in tests.
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">tests/integration.test.ts</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`import { createClient } from "lelu-agent-auth";

const lelu = createClient({
  baseUrl: "http://lelu-engine-666101080696.us-central1.run.app",
  apiKey: "test-key",
});

describe("Lelu Engine", () => {
  it("allows high-confidence actions", async () => {
    const decision = await lelu.authorize({
      action: "send_email",
      confidence: 0.95,
    });
    expect(decision.status).toBe("allow");
  });

  it("routes low-confidence to queue", async () => {
    const decision = await lelu.authorize({
      action: "delete_records",
      confidence: 0.3,
    });
    expect(decision.status).toBe("deny");
  });
});`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">
            3. Mocking Lelu in Application Tests
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            For unit tests that don&apos;t need the Engine running, mock the SDK client.
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">setupTests.ts</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`import { vi } from "vitest";

vi.mock("lelu", () => ({
  LeluClient: vi.fn().mockImplementation(() => ({
    authorize: vi.fn().mockResolvedValue({
      status: "allow",
      requestId: "mock-id",
      requiresHumanReview: false,
      allowed: true,
    }),
  })),
}));`}</pre>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a
          href="/docs/guides/production"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Previous: Production
        </a>
        <a
          href="/docs/migrations"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          Next: Migrations
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
}
