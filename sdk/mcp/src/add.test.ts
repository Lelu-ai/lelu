import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  claudeCommand,
  clientConfig,
  mergeClientConfig,
  parseAddOptions,
  pasteInstructions,
  writeClientConfig,
} from "./add.js";

const STDIO_ARGS = ["-y", "lelu-mcp", "start", "--transport", "stdio", "--preset", "coding-agent"];
const opts = (flags: Record<string, string>) => parseAddOptions(flags, {});

describe("lelu-mcp add defaults", () => {
  it("--cursor gives the stdio command with the coding-agent preset", () => {
    expect(clientConfig(opts({ cursor: "true" }))).toEqual({
      mcpServers: { lelu: { command: "npx", args: STDIO_ARGS } },
    });
  });

  it("--open-code gives the same command in Open Code's format", () => {
    expect(clientConfig(opts({ "open-code": "true" }))).toEqual({
      $schema: "https://opencode.ai/config.json",
      mcp: { servers: { lelu: { type: "local", command: ["npx", ...STDIO_ARGS] } } },
    });
  });

  it("--claude matches the documented Claude Code command", () => {
    expect(claudeCommand(opts({ claude: "true" }))).toBe(
      "claude mcp add lelu -- npx -y lelu-mcp start --transport stdio --preset coding-agent"
    );
  });

  it("--manual and no target give the generic stdio config", () => {
    expect(clientConfig(opts({}))).toEqual(clientConfig(opts({ cursor: "true" })));
    expect(clientConfig(opts({ manual: "true" }))).toEqual(clientConfig(opts({ cursor: "true" })));
  });

  it("--preset changes the preset and rejects unknown ones", () => {
    const cfg = clientConfig(opts({ cursor: "true", preset: "general" })) as { mcpServers: { lelu: { args: string[] } } };
    expect(cfg.mcpServers.lelu.args.slice(-2)).toEqual(["--preset", "general"]);
    expect(() => opts({ preset: "nope" })).toThrow(/Unknown policy preset/);
  });

  it("pins engine URL and API key only when given", () => {
    const o = opts({ cursor: "true", "engine-url": "http://localhost:8083", "api-key": "k" });
    expect(clientConfig(o)).toMatchObject({
      mcpServers: { lelu: { env: { LELU_ENGINE_URL: "http://localhost:8083", LELU_API_KEY: "k" } } },
    });
    expect(clientConfig({ ...o, target: "open-code" })).toMatchObject({
      mcp: { servers: { lelu: { environment: { LELU_ENGINE_URL: "http://localhost:8083", LELU_API_KEY: "k" } } } },
    });
  });

  it("rejects an unknown mode", () => {
    expect(() => opts({ mode: "http" })).toThrow(/--mode must be/);
  });
});

describe("lelu-mcp add --mode sse", () => {
  it("uses the Docker Compose port and includes the Authorization header", () => {
    expect(clientConfig(opts({ cursor: "true", mode: "sse" }))).toEqual({
      mcpServers: { lelu: { url: "http://localhost:3003/sse", headers: { Authorization: "Bearer <MCP_AUTH_TOKEN>" } } },
    });
    expect(clientConfig(opts({ "open-code": "true", mode: "sse" }))).toMatchObject({
      mcp: { servers: { lelu: { type: "remote", url: "http://localhost:3003/sse", headers: { Authorization: "Bearer <MCP_AUTH_TOKEN>" } } } },
    });
    expect(claudeCommand(opts({ claude: "true", mode: "sse" }))).toBe(
      'claude mcp add --transport sse lelu http://localhost:3003/sse --header "Authorization: Bearer $MCP_AUTH_TOKEN"'
    );
  });

  it("honours --url", () => {
    expect(clientConfig(opts({ mode: "sse", url: "http://localhost:3001/sse" }))).toMatchObject({
      mcpServers: { lelu: { url: "http://localhost:3001/sse" } },
    });
  });

  it("tells the user to fill in the token", () => {
    expect(pasteInstructions(opts({ cursor: "true", mode: "sse" }))).toMatch(/MCP_AUTH_TOKEN/);
  });
});

describe("pasteInstructions", () => {
  it("names each client's config file", () => {
    expect(pasteInstructions(opts({ cursor: "true" }))).toMatch(/\.cursor\/mcp\.json.*~\/\.cursor\/mcp\.json/s);
    expect(pasteInstructions(opts({ "open-code": "true" }))).toMatch(/opencode\.json.*~\/\.config\/opencode\/opencode\.json/s);
  });
});

describe("mergeClientConfig", () => {
  it("keeps other servers and settings", () => {
    const merged = mergeClientConfig(
      { mcpServers: { other: { command: "x" }, lelu: { url: "old" } }, extra: 1 },
      opts({ cursor: "true" }),
    );
    expect(merged).toEqual({
      mcpServers: { other: { command: "x" }, lelu: { command: "npx", args: STDIO_ARGS } },
      extra: 1,
    });
  });

  it("keeps an Open Code config's layout and other keys", () => {
    const o = opts({ "open-code": "true" });
    expect(mergeClientConfig({ model: "m", mcp: { servers: { other: { type: "local" } } } }, o)).toEqual({
      $schema: "https://opencode.ai/config.json",
      model: "m",
      mcp: { servers: { other: { type: "local" }, lelu: { type: "local", command: ["npx", ...STDIO_ARGS] } } },
    });
    // Servers listed directly under "mcp" (older layout) stay that way.
    expect(mergeClientConfig({ mcp: { other: { type: "local", command: ["x"], enabled: true } } }, o)).toMatchObject({
      mcp: { other: { type: "local" }, lelu: { type: "local", command: ["npx", ...STDIO_ARGS], enabled: true } },
    });
  });
});

describe("writeClientConfig", () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "lelu-mcp-add-")); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("creates .cursor/mcp.json", async () => {
    const file = await writeClientConfig(dir, opts({ cursor: "true", write: "true" }));
    expect(file).toBe(path.join(dir, ".cursor", "mcp.json"));
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual(clientConfig(opts({ cursor: "true" })));
  });

  it("merges into an existing config instead of replacing it", async () => {
    fs.mkdirSync(path.join(dir, ".cursor"));
    fs.writeFileSync(path.join(dir, ".cursor", "mcp.json"), JSON.stringify({ mcpServers: { other: { command: "x" } } }));
    const file = await writeClientConfig(dir, opts({ cursor: "true" }));
    expect(Object.keys(JSON.parse(fs.readFileSync(file, "utf8")).mcpServers)).toEqual(["other", "lelu"]);
  });

  it("refuses to overwrite a file it can't parse", async () => {
    fs.mkdirSync(path.join(dir, ".cursor"));
    fs.writeFileSync(path.join(dir, ".cursor", "mcp.json"), "{ not json");
    await expect(writeClientConfig(dir, opts({ cursor: "true" }))).rejects.toThrow(/not valid JSON/);
    expect(fs.readFileSync(path.join(dir, ".cursor", "mcp.json"), "utf8")).toBe("{ not json");
  });

  it("writes ./opencode.json for Open Code, but leaves opencode.jsonc to the user", async () => {
    const file = await writeClientConfig(dir, opts({ "open-code": "true" }));
    expect(file).toBe(path.join(dir, "opencode.json"));
    fs.rmSync(file);
    fs.writeFileSync(path.join(dir, "opencode.jsonc"), "// comment\n{}");
    await expect(writeClientConfig(dir, opts({ "open-code": "true" }))).rejects.toThrow(/opencode\.jsonc/);
  });
});
