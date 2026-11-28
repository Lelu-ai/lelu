/**
 * `lelu-mcp add` — prints (or, with --write, writes) the MCP client config for
 * Cursor, Open Code, Claude Code or a generic mcpServers client.
 *
 * The default is the zero-config stdio setup every client can use without
 * anything else running: `npx -y lelu-mcp start --transport stdio --preset
 * coding-agent`, the same command the Claude Code instructions use. `--mode
 * sse` instead points the client at a running HTTP/SSE server (Docker Compose
 * publishes it on host port 3003), which refuses requests without the
 * MCP_AUTH_TOKEN it was started with, so that config carries an
 * Authorization header placeholder.
 */

import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { POLICY_PRESETS } from "./local-engine.js";

export type AddTarget = "cursor" | "claude" | "open-code" | "manual";
export type AddMode = "stdio" | "sse";

/** The SSE URL Docker Compose publishes the MCP server on. */
export const DEFAULT_SSE_URL = "http://localhost:3003/sse";
export const AUTH_HEADER_PLACEHOLDER = "Bearer <MCP_AUTH_TOKEN>";

export interface AddOptions {
  target: AddTarget;
  mode: AddMode;
  preset: string;
  sseUrl: string;
  engineUrl?: string;
  apiKey?: string;
}

export function detectAddTarget(flags: Record<string, string>): AddTarget {
  if (flags["cursor"] === "true") return "cursor";
  if (flags["claude"] === "true") return "claude";
  if (flags["open-code"] === "true") return "open-code";
  return "manual";
}

/** Reads `add` flags (falling back to env), validating mode and preset. */
export function parseAddOptions(flags: Record<string, string>, env: NodeJS.ProcessEnv = process.env): AddOptions {
  const mode = flags["mode"] ?? "stdio";
  if (mode !== "stdio" && mode !== "sse") {
    throw new Error(`--mode must be 'stdio' or 'sse', got: ${mode}`);
  }
  const preset = flags["preset"] ?? "coding-agent";
  if (!(POLICY_PRESETS as readonly string[]).includes(preset)) {
    throw new Error(`Unknown policy preset "${preset}". Use one of: ${POLICY_PRESETS.join(", ")}.`);
  }
  return {
    target: detectAddTarget(flags),
    mode,
    preset,
    sseUrl: flags["url"] ?? env["LELU_MCP_URL"] ?? DEFAULT_SSE_URL,
    engineUrl: flags["engine-url"] ?? env["LELU_ENGINE_URL"],
    apiKey: flags["api-key"] ?? env["LELU_API_KEY"],
  };
}

/** The `npx` command line that runs lelu-mcp over stdio. */
export function stdioArgs(opts: AddOptions): string[] {
  return ["-y", "lelu-mcp", "start", "--transport", "stdio", "--preset", opts.preset];
}

/** Env vars to pin in the client config: only ones the user supplied. With none, lelu-mcp runs its own engine. */
function pinnedEnv(opts: AddOptions): Record<string, string> | undefined {
  const env: Record<string, string> = {};
  if (opts.engineUrl) env["LELU_ENGINE_URL"] = opts.engineUrl;
  if (opts.apiKey) env["LELU_API_KEY"] = opts.apiKey;
  return Object.keys(env).length > 0 ? env : undefined;
}

/** A server entry for clients that use the `mcpServers` format (Cursor, Claude Desktop, ...). */
export function mcpServersEntry(opts: AddOptions): Record<string, unknown> {
  if (opts.mode === "sse") {
    return { url: opts.sseUrl, headers: { Authorization: AUTH_HEADER_PLACEHOLDER } };
  }
  const env = pinnedEnv(opts);
  return { command: "npx", args: stdioArgs(opts), ...(env ? { env } : {}) };
}

/** A server entry in Open Code's format (`mcp.servers.<name>`). */
export function openCodeEntry(opts: AddOptions): Record<string, unknown> {
  if (opts.mode === "sse") {
    return { type: "remote", url: opts.sseUrl, headers: { Authorization: AUTH_HEADER_PLACEHOLDER } };
  }
  const env = pinnedEnv(opts);
  return { type: "local", command: ["npx", ...stdioArgs(opts)], ...(env ? { environment: env } : {}) };
}

export const OPEN_CODE_SCHEMA = "https://opencode.ai/config.json";

/** The full config file content for a target (not used for Claude Code, which takes a command). */
export function clientConfig(opts: AddOptions): Record<string, unknown> {
  if (opts.target === "open-code") {
    return { $schema: OPEN_CODE_SCHEMA, mcp: { servers: { lelu: openCodeEntry(opts) } } };
  }
  return { mcpServers: { lelu: mcpServersEntry(opts) } };
}

/** The `claude mcp add` command for Claude Code. */
export function claudeCommand(opts: AddOptions): string {
  if (opts.mode === "sse") {
    // "sse", not "http": the server speaks the legacy SSE transport.
    return `claude mcp add --transport sse lelu ${opts.sseUrl} --header "Authorization: Bearer $MCP_AUTH_TOKEN"`;
  }
  const env = pinnedEnv(opts);
  const envFlags = env ? Object.entries(env).map(([k, v]) => `--env ${k}=${v} `).join("") : "";
  return `claude mcp add ${envFlags}lelu -- npx ${stdioArgs(opts).join(" ")}`;
}

/** Project-level config file each client reads, relative to the project directory. */
export function projectConfigPath(target: AddTarget): string | null {
  if (target === "cursor") return path.join(".cursor", "mcp.json");
  if (target === "open-code") return "opencode.json";
  return null;
}

/** Where to paste the printed config, for the message printed on stderr. */
export function pasteInstructions(opts: AddOptions): string {
  const lines: string[] = [];
  if (opts.target === "cursor") {
    lines.push(
      "Add this to .cursor/mcp.json in your project (or ~/.cursor/mcp.json for every project),",
      "merging it into an existing \"mcpServers\" object, or rerun with --write to update .cursor/mcp.json here.",
    );
  } else if (opts.target === "open-code") {
    lines.push(
      "Add this to opencode.json in your project (or ~/.config/opencode/opencode.json for every project),",
      "merging it into an existing \"mcp\" object, or rerun with --write to update ./opencode.json.",
    );
  } else {
    lines.push("Add this to your MCP client's config file, merging it into an existing \"mcpServers\" object.");
  }
  const note = lines.map((l) => `[lelu-mcp] ${l}`).join("\n");
  return opts.mode === "sse" ? `${note}\n${authTokenNote()}` : note;
}

/** Reminder that the SSE config's Authorization header is a placeholder. */
export function authTokenNote(): string {
  return (
    `[lelu-mcp] Replace ${AUTH_HEADER_PLACEHOLDER} with "Bearer " plus the MCP_AUTH_TOKEN the server was started with;\n` +
    `[lelu-mcp] without it the server answers 401.`
  );
}

/**
 * Adds or replaces the `lelu` entry in an existing config object, leaving
 * every other server and setting alone.
 */
export function mergeClientConfig(existing: Record<string, unknown>, opts: AddOptions): Record<string, unknown> {
  const out: Record<string, unknown> = { ...existing };
  if (opts.target === "open-code") {
    const mcp = isObject(out["mcp"]) ? { ...out["mcp"] } : {};
    const legacyLayout = Object.keys(mcp).some((k) => k !== "servers");
    if (legacyLayout) {
      // Older Open Code configs list servers directly under "mcp"; keep that layout.
      mcp["lelu"] = { ...openCodeEntry(opts), enabled: true };
    } else {
      mcp["servers"] = { ...(isObject(mcp["servers"]) ? mcp["servers"] : {}), lelu: openCodeEntry(opts) };
    }
    out["mcp"] = mcp;
    if (!("$schema" in out)) return { $schema: OPEN_CODE_SCHEMA, ...out };
    return out;
  }
  out["mcpServers"] = { ...(isObject(out["mcpServers"]) ? out["mcpServers"] : {}), lelu: mcpServersEntry(opts) };
  return out;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Writes the target's project config file under `dir`, merging into an
 * existing one. Refuses (throws) rather than overwrite a file it can't parse.
 * Returns the path written.
 */
export async function writeClientConfig(dir: string, opts: AddOptions): Promise<string> {
  const rel = projectConfigPath(opts.target);
  if (!rel) throw new Error(`--write is only supported with --cursor or --open-code.`);
  const file = path.join(dir, rel);

  if (opts.target === "open-code" && fs.existsSync(path.join(dir, "opencode.jsonc"))) {
    // JSONC may hold comments that a JSON rewrite would drop.
    throw new Error(`This project has opencode.jsonc; add the config printed above to it by hand.`);
  }

  let existing: Record<string, unknown> = {};
  let raw: string | undefined;
  try {
    raw = await fsp.readFile(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  if (raw !== undefined && raw.trim()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`${file} is not valid JSON (${(err as Error).message}); not overwriting it. Add the config printed above by hand.`);
    }
    if (!isObject(parsed)) throw new Error(`${file} does not hold a JSON object; not overwriting it.`);
    existing = parsed;
  }

  const merged = mergeClientConfig(existing, opts);
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return file;
}

/** Runs `lelu-mcp add`. Output goes to stdout; notes go to stderr. */
export async function runAdd(flags: Record<string, string>, cwd = process.cwd()): Promise<void> {
  const opts = parseAddOptions(flags);

  if (opts.target === "claude") {
    console.log(claudeCommand(opts));
    if (opts.mode === "sse") {
      console.error("[lelu-mcp] Run this with MCP_AUTH_TOKEN set to the token the server was started with.");
    }
    return;
  }

  const output = JSON.stringify(clientConfig(opts), null, 2);
  console.log(output);

  if (flags["write"] === "true" && opts.target !== "manual") {
    const file = await writeClientConfig(cwd, opts);
    console.error(`[lelu-mcp] Wrote the "lelu" server to ${file}`);
    if (opts.mode === "sse") console.error(authTokenNote());
    return;
  }
  console.error(pasteInstructions(opts));
}
