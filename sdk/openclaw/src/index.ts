// OpenClaw plugin entry: registers Lelu's guard on every tool call.

import { buildJsonPluginConfigSchema, definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { CONFIG_JSON_SCHEMA, readConfig } from "./config.js";
import { createToolGuard, PLUGIN_ID } from "./guard.js";

export { DEFAULT_RULES, evaluate, compileRules, type Rule, type Verdict } from "./rules.js";
export { createToolGuard } from "./guard.js";
export { CONFIG_JSON_SCHEMA, readConfig, type LeluPluginConfig } from "./config.js";

// Runs before other policy plugins so a block from Lelu is final.
const HOOK_PRIORITY = 100;

export default definePluginEntry({
  id: PLUGIN_ID,
  name: "Lelu",
  description:
    "Blocks dangerous tool calls (like rm -rf ~) and asks you before risky ones (sudo, force-push, sending email, publishing).",
  configSchema: buildJsonPluginConfigSchema(CONFIG_JSON_SCHEMA),
  register(api) {
    const config = readConfig(api.pluginConfig);
    const log = api.logger;
    const guard = createToolGuard(config, {
      onDecision: (d) => log?.info?.(`[lelu] ${d.verdict} ${d.toolName}${d.ruleId ? ` (${d.ruleId})` : ""}: ${d.reason}`),
      onApproval: (a) => log?.info?.(`[lelu] approval ${a.decision} for ${a.toolName} (${a.ruleId})`),
    });
    api.on("before_tool_call", (event) => guard(event), { priority: HOOK_PRIORITY });
  },
});
