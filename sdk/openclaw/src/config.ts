// The plugin's settings (plugins.entries.lelu.config in openclaw.json).
//
// CONFIG_JSON_SCHEMA is the single source for both the runtime check in the
// plugin entry and openclaw.plugin.json; a test keeps the two identical.

import { DEFAULT_RULES, type Rule } from "./rules.js";

export interface LeluPluginConfig {
  /** Ids of built-in rules to switch off, e.g. "lelu.sudo". */
  disableRules: string[];
  /** Extra rules, checked together with the built-in ones. */
  rules: Rule[];
  /** How long an approval request waits before it counts as denied. */
  approvalTimeoutSeconds: number;
}

export const DEFAULT_APPROVAL_TIMEOUT_SECONDS = 120;

const RULE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["id", "tools", "verdict", "reason"],
  properties: {
    id: { type: "string", minLength: 1 },
    tools: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
    verdict: { type: "string", enum: ["deny", "review"] },
    reason: { type: "string", minLength: 1 },
    command: { type: "string", minLength: 1 },
    path: { type: "string", minLength: 1 },
    exceptActions: { type: "array", items: { type: "string" } },
  },
} as const;

export const CONFIG_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    disableRules: {
      type: "array",
      items: { type: "string" },
      description: "Ids of built-in Lelu rules to switch off, for example lelu.sudo.",
    },
    rules: {
      type: "array",
      items: RULE_SCHEMA,
      description: "Your own rules, checked together with the built-in ones.",
    },
    approvalTimeoutSeconds: {
      type: "integer",
      minimum: 10,
      maximum: 3600,
      description: "How long an approval request waits before it counts as denied.",
    },
  },
} as const;

function stringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/**
 * Reads the plugin config, filling in defaults. OpenClaw validates it against
 * CONFIG_JSON_SCHEMA first; this stays defensive so a missing or partial
 * config never disables the built-in rules.
 */
export function readConfig(raw: unknown): LeluPluginConfig {
  const c = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const timeout = c.approvalTimeoutSeconds;
  return {
    disableRules: stringList(c.disableRules),
    rules: Array.isArray(c.rules) ? (c.rules as Rule[]) : [],
    approvalTimeoutSeconds:
      typeof timeout === "number" && Number.isFinite(timeout) && timeout >= 10 && timeout <= 3600
        ? Math.floor(timeout)
        : DEFAULT_APPROVAL_TIMEOUT_SECONDS,
  };
}

/** Built-in rules minus the disabled ones, followed by the user's rules. */
export function activeRules(config: LeluPluginConfig): Rule[] {
  const off = new Set(config.disableRules);
  return [...DEFAULT_RULES.filter((r) => !off.has(r.id)), ...config.rules];
}
