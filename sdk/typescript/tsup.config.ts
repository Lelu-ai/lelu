import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/storage.ts", "src/langchain/index.ts", "src/langgraph/index.ts", "src/react/index.ts", "src/express/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  target: "es2022",
});
