import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import plugin from "./index.js";
import { CONFIG_JSON_SCHEMA, DEFAULT_APPROVAL_TIMEOUT_SECONDS, readConfig } from "./config.js";
import { createToolGuard, PLUGIN_ID, preview } from "./guard.js";

const guard = (config: unknown = {}, options = {}) => createToolGuard(readConfig(config), options);

describe("before_tool_call answers", () => {
  it("lets ordinary calls through with no decision", () => {
    expect(guard()({ toolName: "exec", params: { command: "ls -la" } })).toBeUndefined();
    expect(guard()({ toolName: "read", params: { path: "README.md" } })).toBeUndefined();
  });

  it("blocks a dangerous call and says which rule and how to turn it off", () => {
    const r = guard()({ toolName: "exec", params: { command: "rm -rf ~" } });
    expect(r?.block).toBe(true);
    expect(r?.blockReason).toContain("lelu.rm-home-or-root");
    expect(r?.blockReason).toContain("disableRules");
    expect(r?.requireApproval).toBeUndefined();
  });

  it("asks for approval on a risky call, allowing once or deny only", () => {
    const r = guard()({ toolName: "exec", params: { command: "git push --force" } });
    expect(r?.block).toBeUndefined();
    expect(r?.requireApproval).toMatchObject({
      title: "Lelu: Rewrites or throws away git history",
      severity: "warning",
      timeoutMs: DEFAULT_APPROVAL_TIMEOUT_SECONDS * 1000,
      allowedDecisions: ["allow-once", "deny"],
    });
    expect(r?.requireApproval?.description).toContain("git push --force");
    expect(r?.requireApproval?.description).toContain("lelu.git-destructive");
  });

  it("reports the user's answer to an approval", () => {
    const onApproval = vi.fn();
    const r = guard({}, { onApproval })({ toolName: "exec", params: { command: "sudo ls" } });
    r?.requireApproval?.onResolution?.("deny");
    expect(onApproval).toHaveBeenCalledWith({ toolName: "exec", ruleId: "lelu.sudo", decision: "deny" });
  });

  it("fails closed: an error while checking blocks the call", () => {
    const onDecision = vi.fn(() => {
      throw new Error("logger exploded");
    });
    const r = guard({}, { onDecision })({ toolName: "exec", params: { command: "sudo ls" } });
    expect(r?.block).toBe(true);
    expect(r?.blockReason).toMatch(/could not check/);
  });

  it("tolerates odd events without throwing", () => {
    const g = guard();
    expect(g({ toolName: "exec" })).toBeUndefined();
    expect(g({ toolName: "exec", params: { command: 42 } as unknown as Record<string, unknown> })).toBeUndefined();
    expect(g(undefined as unknown as { toolName: string })).toBeUndefined();
  });
});

describe("config", () => {
  it("defaults keep every built-in rule on", () => {
    expect(readConfig(undefined)).toEqual({ disableRules: [], rules: [], approvalTimeoutSeconds: DEFAULT_APPROVAL_TIMEOUT_SECONDS });
    expect(readConfig({ approvalTimeoutSeconds: 1 }).approvalTimeoutSeconds).toBe(DEFAULT_APPROVAL_TIMEOUT_SECONDS);
  });

  it("disableRules switches a built-in rule off", () => {
    const g = guard({ disableRules: ["lelu.sudo"] });
    expect(g({ toolName: "exec", params: { command: "sudo apt update" } })).toBeUndefined();
    // Other rules still apply to the same command.
    expect(g({ toolName: "exec", params: { command: "sudo rm -rf /" } })?.block).toBe(true);
  });

  it("custom rules apply alongside the built-in ones", () => {
    const g = guard({
      rules: [{ id: "no-prod-db", tools: ["exec"], verdict: "deny", reason: "Touches the production database", command: "prod-db\\." }],
      approvalTimeoutSeconds: 30,
    });
    expect(g({ toolName: "exec", params: { command: "psql -h prod-db.internal" } })?.blockReason).toContain("no-prod-db");
    expect(g({ toolName: "exec", params: { command: "sudo ls" } })?.requireApproval?.timeoutMs).toBe(30_000);
  });

  it("an invalid custom rule is reported when the plugin starts", () => {
    expect(() => guard({ rules: [{ id: "bad", tools: ["exec"], verdict: "deny", reason: "x", command: "[" }] })).toThrow(/bad/);
  });
});

describe("preview", () => {
  it("shortens long commands to one line", () => {
    const p = preview({ toolName: "exec", params: { command: `echo ${"x".repeat(1000)}\nls` } });
    expect(p.length).toBeLessThanOrEqual(401);
    expect(p).not.toContain("\n");
  });
});

describe("plugin entry and manifest", () => {
  const manifest = JSON.parse(readFileSync(new URL("../openclaw.plugin.json", import.meta.url), "utf8"));
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const entry = plugin as unknown as {
    id: string;
    configSchema: { jsonSchema: unknown };
    register(api: unknown): void;
  };

  it("manifest and entry agree on id and config schema", () => {
    expect(manifest.id).toBe(PLUGIN_ID);
    expect(entry.id).toBe(PLUGIN_ID);
    expect(manifest.configSchema).toEqual(CONFIG_JSON_SCHEMA);
    expect(entry.configSchema.jsonSchema).toEqual(CONFIG_JSON_SCHEMA);
  });

  it("package points OpenClaw at the built entry", () => {
    expect(pkg.openclaw.extensions).toEqual(["./dist/index.js"]);
    expect(pkg.files).toContain("openclaw.plugin.json");
  });

  it("registers one before_tool_call hook that uses the plugin config", () => {
    const on = vi.fn();
    entry.register({ pluginConfig: { disableRules: ["lelu.sudo"] }, logger: { info: vi.fn() }, on });
    expect(on).toHaveBeenCalledTimes(1);
    const [hook, handler, opts] = on.mock.calls[0];
    expect(hook).toBe("before_tool_call");
    expect(opts).toEqual({ priority: 100 });
    expect(handler({ toolName: "exec", params: { command: "sudo ls" } })).toBeUndefined();
    expect(handler({ toolName: "exec", params: { command: "rm -rf /" } })?.block).toBe(true);
  });
});
