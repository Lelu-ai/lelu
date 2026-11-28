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
 *   --preset      <name>  Starter policy preset: general | coding-agent (default: general)
 *
 * If the local engine can't start, lelu-mcp exits; it only uses another
 * engine when asked to (--engine-url, LELU_ENGINE_URL or --no-local).
 *
 * Environment variables:
 *   LELU_ENGINE_URL      Lelu Engine base URL (disables local mode)
 *   LELU_API_KEY         Lelu Engine API key
 *   LELU_HOME            Local data dir (default ~/.lelu)
 *   LELU_ENGINE_BINARY   Use a locally built engine binary (skips download)
 *   LELU_ENGINE_VERSION  Pin an engine release version (default: latest)
 *   LELU_POLICY_PATH     Policy file for the local engine (default ~/.lelu/policy.yaml)
 *   LELU_POLICY_PRESET   Starter policy preset: general | coding-agent
 */

import { runAdd } from "./add.js";
import { runStdio, runHttp } from "./server.js";
import { engineIsHealthy, startLocalEngine, type LocalEngine } from "./local-engine.js";

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
  --no-local            Never spawn a local engine; use the one on localhost:8082
  --preset     <name>   Starter policy preset: general | coding-agent  (default: general)
                        coding-agent allows edit/test/build, sends installs, pushes
                        and deploys to human review; written to ~/.lelu/policy.coding-agent.yaml

If the local engine can't be started, lelu-mcp exits with the reason. It only
talks to an engine elsewhere when you ask for one (--engine-url, LELU_ENGINE_URL
or --no-local).

Add command options (prints the config; notes on where it goes go to stderr):
  --cursor             Cursor config (.cursor/mcp.json)
  --claude             Claude Code command
  --open-code          Open Code config (opencode.json)
  --manual             Generic mcpServers config (default)
  --mode <mode>        stdio | sse  (default: stdio — runs
                       "npx -y lelu-mcp start --transport stdio --preset coding-agent")
  --preset <name>      Preset for the stdio command (default: coding-agent)
  --url <url>          SSE endpoint for --mode sse (default: http://localhost:3003/sse,
                       the port Docker Compose publishes; the config includes an
                       "Authorization: Bearer <MCP_AUTH_TOKEN>" header to fill in)
  --write              Add the server to .cursor/mcp.json or ./opencode.json in the
                       current directory, keeping the servers already there

Tools exposed to the AI agent:
  lelu_agent_authorize   Authorize an agent action (confidence-aware)
  lelu_authorize         Authorize a human user action
  lelu_mint_token        Mint a short-lived scoped JWT
  lelu_revoke_token      Revoke a JIT token immediately
  lelu_get_review        Read a human-review item's status by review_id
  lelu_health            Check Engine health

Examples:
  # Zero-config: download + run a local engine, no account needed
  npx lelu-mcp start

  # Start with a custom Engine URL and API key
  npx lelu-mcp start --engine-url http://lelu.internal:8082 --api-key sk_live_xxx

  # Cursor / Claude Desktop config (.cursor/mcp.json or claude_desktop_config.json):
  # {
  #   "mcpServers": {
  #     "lelu": {
  #       "command": "npx",
  #       "args": ["-y", "lelu-mcp", "start", "--transport", "stdio", "--preset", "coding-agent"]
  #     }
  #   }
  # }

  # Print client setup snippets
  npx lelu-mcp add --cursor
  npx lelu-mcp add --claude
  npx lelu-mcp add --open-code

  # Add lelu to the Cursor config of the project in the current directory
  npx lelu-mcp add --cursor --write

  # Point Cursor at the Docker Compose HTTP/SSE server instead
  npx lelu-mcp add --cursor --mode sse
`);
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
    try {
      await runAdd(flags);
    } catch (err) {
      console.error(`[lelu-mcp] ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
    return;
  }

  // An empty LELU_ENGINE_URL counts as unset, not as a URL.
  const explicitUrl = flags["engine-url"] || process.env["LELU_ENGINE_URL"] || undefined;
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
  let localEngine: LocalEngine | undefined;
  if (!explicitUrl && flags["no-local"] !== "true") {
    try {
      localEngine = await startLocalEngine({ preset: flags["preset"] });
      engineUrl = localEngine.url;
      // The launcher starts the engine with a generated per-install key —
      // use it unless the user supplied their own.
      apiKey = apiKey ?? localEngine.apiKey;
    } catch (err) {
      // No fallback to whatever happens to answer on localhost:8082: that
      // would send authorization decisions to an engine the user never chose
      // (with a policy and key they never set), noted only on stderr. Using
      // another engine takes an explicit --engine-url / LELU_ENGINE_URL or
      // --no-local. Exit so the MCP host shows the failure.
      console.error(`[lelu-mcp] Could not start a local engine: ${err instanceof Error ? err.message : err}`);
      console.error(
        `[lelu-mcp] Exiting. Fix the error above, or to use an engine you run yourself pass ` +
        `--engine-url <url> --api-key <key> (or set LELU_ENGINE_URL / LELU_API_KEY).`
      );
      process.exit(1);
    }
  } else if (!explicitUrl && !(await engineIsHealthy(engineUrl))) {
    // --no-local: the user asked for the engine on localhost:8082.
    console.error(`[lelu-mcp] --no-local was given but no engine answers at ${engineUrl}/healthz; tool calls will fail until one does.`);
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
      // The client closed stdin: nobody is left to serve. Stop the engine we
      // spawned (if any) and exit rather than lingering until SIGTERM.
      console.error(`[lelu-mcp] stdin closed by the client; shutting down.`);
      localEngine?.stop();
      process.exit(0);
    }
  } catch (err) {
    console.error("[lelu-mcp] Fatal error:", err);
    process.exit(1);
  }
}

main();
