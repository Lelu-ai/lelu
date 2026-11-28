// The slice of OpenClaw's plugin SDK this plugin uses. OpenClaw is a peer
// dependency (the Gateway provides it at runtime), so it is not installed here;
// these declarations follow openclaw/plugin-sdk/plugin-entry as of 2026.11.
declare module "openclaw/plugin-sdk/plugin-entry" {
  export interface PluginLogger {
    debug?: (message: string) => void;
    info?: (message: string) => void;
    warn?: (message: string) => void;
    error?: (message: string) => void;
  }

  export interface OpenClawPluginApi {
    pluginConfig?: Record<string, unknown>;
    logger?: PluginLogger;
    on(
      hook: "before_tool_call",
      handler: (
        event: { toolName: string; params?: Record<string, unknown>; derivedPaths?: readonly string[] },
        ctx: unknown,
      ) => unknown,
      options?: { priority?: number; matcher?: string[] },
    ): void;
  }

  export interface PluginConfigSchema {
    safeParse(value: unknown): unknown;
    jsonSchema: unknown;
  }

  export function buildJsonPluginConfigSchema(schema: object, options?: { uiHints?: Record<string, unknown> }): PluginConfigSchema;

  export function definePluginEntry(entry: {
    id: string;
    name: string;
    description: string;
    configSchema?: PluginConfigSchema;
    register(api: OpenClawPluginApi): void;
  }): unknown;
}
