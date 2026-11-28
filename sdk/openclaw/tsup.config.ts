import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node20",
  // Provided by the OpenClaw Gateway at runtime; never bundled.
  external: ["openclaw", /^openclaw\//],
});
