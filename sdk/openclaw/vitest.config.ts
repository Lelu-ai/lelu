import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // OpenClaw is a peer dependency the Gateway provides; tests use a stand-in
    // that behaves like openclaw/plugin-sdk/plugin-entry.
    alias: {
      "openclaw/plugin-sdk/plugin-entry": fileURLToPath(new URL("./test/openclaw-stub.ts", import.meta.url)),
    },
  },
  test: { include: ["src/**/*.test.ts", "test/**/*.test.ts"] },
});
