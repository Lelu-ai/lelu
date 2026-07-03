#!/usr/bin/env node
/**
 * lelu-mcp CLI
 *
 * Usage:
 *   npx lelu-mcp start [options]
 *   npx lelu-mcp add [target] [options]
 *
 * Zero-config: with no --engine-url / LELU_ENGINE_URL, lelu-mcp downloads the
 * engine binary on first run (cached in ~/.lelu/bin), starts it locally with a
 * starter policy (~/.lelu/policy.yaml), and connects to it. No account needed.
 *
 * Options:
 *   --engine-url  <url>   Lelu Engine base URL (default: run a local engine)
 *   --api-key     <key>   Lelu Engine API key  (or set LELU_API_KEY env var)
 *   --timeout     <ms>    Request timeout in ms  (default: 10000)
 *   --no-local            Never spawn a local engine; use http://localhost:8082
 *
 * Environment variables:
 *   LELU_ENGINE_URL      Lelu Engine base URL (disables local mode)
 *   LELU_API_KEY         Lelu Engine API key
 *   LELU_HOME            Local data dir (default ~/.lelu)
 *   LELU_ENGINE_BINARY   Use a locally built engine binary (skips download)
 *   LELU_ENGINE_VERSION  Pin an engine release version (default: latest)
 *   LELU_POLICY_PATH     Policy file for the local engine (default ~/.lelu/policy.yaml)
 */

import { runStdio, runHttp } from "./server.js";
import { startLocalEngine } from "./local-engine.js";

// ─── Minimal arg parser ───────────────────────────────────────────────────────

function parseArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg?.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        result[key] = next;
        i++;
      } else {
        result[key] = "true";
      }
    }
  }
  return result;
}

function printHelp() {
  console.error(`
lelu-mcp — Model Context Protocol server for Lelu

Usage:
  npx lelu-mcp start [options]
  npx lelu-mcp add [target] [options]

Zero-config: with no --engine-url, lelu-mcp downloads the Lelu engine on first
run (cached in ~/.lelu/bin), starts it locally with a starter policy at
~/.lelu/policy.yaml, and connects to it. No account or registration needed.

Options:
  --engine-url <url>    Lelu Engine base URL (default: run a local engine)
  --api-key    <key>    Lelu Engine API key  (or LELU_API_KEY env var)
  --timeout    <ms>     Request timeout in ms  (default: 10000)
  --transport  <mode>   Transport mode: stdio | http  (default: stdio)
  --port       <port>   HTTP port when --transport=http  (default: 3001)
  --no-local            Never spawn a local engine; expect one on localhost:8082

Add command options:
  --cursor             Print Cursor MCP config snippet
  --claude             Print Claude Code command
  --open-code          Print Open Code MCP config snippet
  --manual             Print a generic mcpServers config snippet
  --mode <mode>        Connection mode: sse | stdio (default: sse)
  --url <url>          SSE endpoint URL (default: http://localhost:3001/sse)
  --write              Write config to a local file for Cursor/Open Code

Tools exposed to the AI agent:
  lelu_agent_authorize   Authorize an agent action (confidence-aware)
  lelu_authorize         Authorize a human user action
  lelu_mint_token        Mint a short-lived scoped JWT
  lelu_revoke_token      Revoke a JIT token immediately
  lelu_health            Check Engine health

Examples:
  # Zero-config: download + run a local engine, no account needed
  npx lelu-mcp start

  # Start with a custom Engine URL and API key
  npx lelu-mcp start --engine-url http://lelu.internal:8082 --api-key sk_live_xxx

  # Cursor / Claude Desktop config (settings.json or claude_desktop_config.json):
  # {
  #   "mcpServers": {
  #     "lelu": {
  #       "command": "npx",
  #       "args": ["lelu-mcp", "start"],
  #       "env": {
  #         "LELU_ENGINE_URL": "http://localhost:8082",
  #         "LELU_API_KEY": "your_key"
  #       }
  #     }
  #   }
  # }

  # Print client setup snippets
  npx lelu-mcp add --cursor
  npx lelu-mcp add --claude
  npx lelu-mcp add --open-code

  # Write a Cursor config file in the current project
  npx lelu-mcp add --cursor --write
`);
}

type AddTarget = "cursor" | "claude" | "open-code" | "manual";

function detectAddTarget(flags: Record<string, string>): AddTarget {
  if (flags["cursor"] === "true") return "cursor";
  if (flags["claude"] === "true") return "claude";
  if (flags["open-code"] === "true") return "open-code";
  if (flags["manual"] === "true") return "manual";
  return "manual";
}

function buildMcpServerConfig(flags: Record<string, string>): Record<string, unknown> {
  const mode = flags["mode"] ?? "sse";
  const engineUrl = flags["engine-url"] ?? process.env["LELU_ENGINE_URL"];
  const apiKey = flags["api-key"] ?? process.env["LELU_API_KEY"];
  const sseUrl = flags["url"] ?? process.env["LELU_MCP_URL"] ?? "http://localhost:3001/sse";

  if (mode === "stdio") {
    // Only pin env vars the user explicitly provided — with no LELU_ENGINE_URL,
    // lelu-mcp runs a local engine automatically (zero-config mode).
    const env: Record<string, string> = {};
    if (engineUrl) env["LELU_ENGINE_URL"] = engineUrl;
    if (apiKey) env["LELU_API_KEY"] = apiKey;
    return {
      command: "npx",
      args: ["-y", "lelu-mcp", "start", "--transport", "stdio"],
      ...(Object.keys(env).length > 0 ? { env } : {}),
    };
  }

  return { url: sseUrl };
}

async function runAdd(flags: Record<string, string>): Promise<void> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");

  const mode = flags["mode"] ?? "sse";
  if (mode !== "sse" && mode !== "stdio") {
    console.error(`--mode must be 'sse' or 'stdio', got: ${mode}`);
    process.exit(1);
  }

  const target = detectAddTarget(flags);
  const mcpServerConfig = buildMcpServerConfig(flags);
  const wrappedConfig = { mcpServers: { lelu: mcpServerConfig } };

  if (target === "claude") {
    const sseUrl = flags["url"] ?? process.env["LELU_MCP_URL"] ?? "http://localhost:3001/sse";
    if (mode === "stdio") {
      console.log("claude mcp add lelu -- npx -y lelu-mcp start --transport stdio");
      return;
    }
    console.log(`claude mcp add --transport http lelu ${sseUrl}`);
    return;
  }

  const output = JSON.stringify(wrappedConfig, null, 2);
  const shouldWrite = flags["write"] === "true";

  if (!shouldWrite || target === "manual") {
    console.log(output);
    return;
  }

  const cwd = process.cwd();
  const targetPath = target === "cursor"
    ? path.join(cwd, ".cursor", "mcp.json")
    : path.join(cwd, ".opencode", "mcp.json");

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, output + "\n", "utf8");
  console.error(`[lelu-mcp] Wrote ${targetPath}`);
  console.log(output);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args    = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    process.exit(command ? 0 : 1);
  }

  if (command !== "start" && command !== "add") {
    console.error(`Unknown command: ${command}\nRun "npx lelu-mcp --help" for usage.`);
    process.exit(1);
  }

  const flags = parseArgs(args.slice(1));

  if (command === "add") {
    await runAdd(flags);
    return;
  }

  const explicitUrl = flags["engine-url"] ?? process.env["LELU_ENGINE_URL"];
  let engineUrl     = explicitUrl ?? "http://localhost:8082";
  let apiKey       = flags["api-key"]    ?? process.env["LELU_API_KEY"];
  const timeoutMs  = flags["timeout"]    ? parseInt(flags["timeout"], 10) : 10_000;
  const transport  = flags["transport"]  ?? process.env["MCP_TRANSPORT"] ?? "stdio";
  const port       = flags["port"]       ? parseInt(flags["port"], 10)
                   : process.env["MCP_PORT"] ? parseInt(process.env["MCP_PORT"], 10)
                   : 3001;

  if (isNaN(timeoutMs) || timeoutMs < 1) {
    console.error("--timeout must be a positive integer (milliseconds)");
    process.exit(1);
  }

  if (transport !== "stdio" && transport !== "http") {
    console.error(`--transport must be 'stdio' or 'http', got: ${transport}`);
    process.exit(1);
  }

  // Zero-config mode: no engine URL given → download (once) and run a local
  // engine with the starter policy. Everything stays on this machine.
  if (!explicitUrl && flags["no-local"] !== "true") {
    try {
      const local = await startLocalEngine();
      engineUrl = local.url;
      // The launcher starts the engine with a generated per-install key —
      // use it unless the user supplied their own.
      apiKey = apiKey ?? local.apiKey;
    } catch (err) {
      console.error(`[lelu-mcp] Could not start a local engine: ${err instanceof Error ? err.message : err}`);
      console.error(`[lelu-mcp] Falling back to ${engineUrl} — start an engine there or pass --engine-url.`);
    }
  }

  // Log to stderr so it doesn't pollute the MCP stdio stream
  console.error(`[lelu-mcp] Starting MCP server`);
  console.error(`[lelu-mcp]   Engine URL : ${engineUrl}`);
  console.error(`[lelu-mcp]   API key    : ${apiKey ? "***" + apiKey.slice(-4) : "(none)"}`);
  console.error(`[lelu-mcp]   Timeout    : ${timeoutMs}ms`);
  console.error(`[lelu-mcp]   Transport  : ${transport}${transport === "http" ? ` (port ${port})` : ""}`);

  try {
    if (transport === "http") {
      await runHttp({ engineUrl, apiKey, timeoutMs }, port);
    } else {
      console.error(`[lelu-mcp] Listening on stdio…`);
      await runStdio({ engineUrl, apiKey, timeoutMs });
    }
  } catch (err) {
    console.error("[lelu-mcp] Fatal error:", err);
    process.exit(1);
  }
}

main();
