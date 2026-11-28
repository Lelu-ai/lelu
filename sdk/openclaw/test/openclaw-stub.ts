// Test stand-in for openclaw/plugin-sdk/plugin-entry, mirroring what the real
// helpers return (see openclaw@2026.11.8 dist/plugin-entry and config-schema).
export function definePluginEntry<T extends object>(entry: T): T {
  return entry;
}

export function buildJsonPluginConfigSchema(schema: object) {
  return { jsonSchema: schema, safeParse: (value: unknown) => ({ success: true, data: value }) };
}
