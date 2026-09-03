import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import * as http from "http";
import * as crypto from "crypto";
import { z } from "zod";

// ─── Config ───────────────────────────────────────────────────────────────────

export interface LeluMcpConfig {
  /** Lelu Engine base URL. Default: http://localhost:8082 */
  engineUrl?: string;
  /** Lelu Engine API key */
  apiKey?: string;
  /** Request timeout in ms. Default: 10_000 */
  timeoutMs?: number;
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function call<T>(
  method: "GET" | "POST" | "DELETE",
  baseUrl: string,
  apiKey: string | undefined,
  timeoutMs: number,
  path: string,
  body?: unknown
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(
        `Lelu Engine error ${res.status}: ${(json["error"] as string) ?? JSON.stringify(json)}`
      );
    }
    return json as T;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Server factory ───────────────────────────────────────────────────────────

export function createLeluMcpServer(cfg: LeluMcpConfig = {}): McpServer {
  const baseUrl  = (cfg.engineUrl  ?? process.env["LELU_ENGINE_URL"] ?? "http://localhost:8082").replace(/\/$/, "");
  const apiKey   = cfg.apiKey      ?? process.env["LELU_API_KEY"];
  const timeout  = cfg.timeoutMs   ?? 10_000;

  const post = <T>(path: string, body: unknown) =>
    call<T>("POST", baseUrl, apiKey, timeout, path, body);

  const get = <T>(path: string) =>
    call<T>("GET", baseUrl, apiKey, timeout, path);

  const del = <T>(path: string) =>
    call<T>("DELETE", baseUrl, apiKey, timeout, path);

  // ── MCP Server ──────────────────────────────────────────────────────────────

  const server = new McpServer({
    name:    "lelu",
    version: "1.0.0",
  });

  // ── Tool: agent_authorize ──────────────────────────────────────────────────
  server.tool(
    "lelu_agent_authorize",
    "Ask the Lelu Engine whether an AI agent is allowed to perform an action. " +
    "Lelu evaluates the action against your policy using behavioral signals. " +
    "In production, confidence comes from a submitted provider signal (logprobs/entropy), never agent self-reports. " +
    "Returns allowed/denied/requires_human_review along with a request ID for HITL polling.",
    {
      actor:     z.string().describe("The agent or bot performing the action, e.g. 'invoice_bot'"),
      action:    z.string().describe("The action being requested, e.g. 'delete_records'"),
      resource:  z.string().optional().describe("Optional resource the action targets, e.g. 'invoice:42'"),
      actingFor: z.string().optional().describe("User ID the agent is acting on behalf of"),
      scope:     z.string().optional().describe("Requested permission scope, e.g. 'read:invoices'"),
      confidence: z.number().min(0).max(1).optional().describe(
        "Self-reported confidence (0–1) that this action is correct. Dev-mode only: honored when " +
        "the engine runs with CONFIDENCE_ALLOW_UNVERIFIED=true (the zero-config local default). " +
        "Production engines require a submitted provider signal instead; when omitted, the engine's " +
        "CONFIDENCE_MISSING_MODE decides (local default: route to human review)."
      ),
    },
    async ({ actor, action, resource, actingFor, scope, confidence }) => {
      const data = await post<{
        allowed: boolean;
        reason: string;
        trace_id: string;
        requires_human_review: boolean;
        confidence_used: number;
        provider_signal_present: boolean;
        downgraded_scope?: string;
      }>("/v1/agent/authorize", {
        actor,
        action,
        // Engine expects resource as a string map, not a bare string.
        ...(resource ? { resource: { id: resource } } : {}),
        acting_for: actingFor,
        scope,
        ...(confidence !== undefined ? { confidence } : {}),
      });

      const status = data.requires_human_review
        ? "REQUIRES_HUMAN_REVIEW"
        : data.allowed
        ? "ALLOWED"
        : "DENIED";

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                status,
                allowed:              data.allowed,
                requires_human_review: data.requires_human_review,
                reason:               data.reason,
                trace_id:             data.trace_id,
                confidence_used:      data.confidence_used,
                // false whenever this decision relied on a self-reported
                // confidence number (or none at all) rather than a submitted
                // provider signal — see the `confidence` param description.
                // Not a claim the signal was confirmed against the provider
                // itself, only that one was submitted and well-formed.
                provider_signal_present: data.provider_signal_present,
                ...(data.downgraded_scope ? { downgraded_scope: data.downgraded_scope } : {}),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── Tool: authorize (human) ────────────────────────────────────────────────
  server.tool(
    "lelu_authorize",
    "Check whether a human user is permitted to perform an action. " +
    "Use lelu_agent_authorize instead when the actor is an AI agent.",
    {
      userId:   z.string().describe("The user performing the action"),
      action:   z.string().describe("The action being requested"),
      resource: z.string().optional().describe("Optional resource identifier"),
    },
    async ({ userId, action, resource }) => {
      const data = await post<{
        allowed: boolean;
        reason: string;
        trace_id: string;
      }>("/v1/authorize", {
        user_id: userId,
        action,
        ...(resource ? { resource: { id: resource } } : {}),
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                allowed:  data.allowed,
                reason:   data.reason,
                trace_id: data.trace_id,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── Tool: mint_token ───────────────────────────────────────────────────────
  server.tool(
    "lelu_mint_token",
    "Mint a short-lived scoped JWT for an AI agent. The token expires after ttlSeconds (default 60 s). " +
    "Use this when you need to grant an agent temporary credentials for a specific scope rather than calling authorize on every action.",
    {
      scope:      z.string().describe("Permission scope to grant, e.g. 'read:invoices write:comments'"),
      actingFor:  z.string().optional().describe("User ID the agent is acting on behalf of"),
      ttlSeconds: z.number().int().min(1).max(3600).default(60).describe("Token lifetime in seconds (default 60, max 3600)"),
    },
    async ({ scope, actingFor, ttlSeconds }) => {
      const data = await post<{
        token: string;
        token_id: string;
        expires_at: number;
      }>("/v1/tokens/mint", {
        scope,
        acting_for: actingFor,
        ttl_seconds: ttlSeconds,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                token:      data.token,
                token_id:   data.token_id,
                expires_at: new Date(data.expires_at * 1000).toISOString(),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── Tool: revoke_token ─────────────────────────────────────────────────────
  server.tool(
    "lelu_revoke_token",
    "Immediately revoke a JIT token by its ID. Use this when a task is complete or when suspicious activity is detected.",
    {
      tokenId: z.string().describe("The token ID returned by lelu_mint_token"),
    },
    async ({ tokenId }) => {
      const data = await del<{ success: boolean }>(`/v1/tokens/${encodeURIComponent(tokenId)}`);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ success: data.success }, null, 2),
          },
        ],
      };
    }
  );

  // ── Tool: health ───────────────────────────────────────────────────────────
  server.tool(
    "lelu_health",
    "Check whether the Lelu Engine is reachable and healthy. Returns the engine status and version.",
    {},
    async () => {
      const data = await get<{ status: string; version?: string }>("/healthz");

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { healthy: data.status === "ok", status: data.status, version: data.version },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}

// ─── Stdio runner ─────────────────────────────────────────────────────────────

export async function runStdio(cfg?: LeluMcpConfig): Promise<void> {
  const server    = createLeluMcpServer(cfg);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// ─── HTTP/SSE runner ──────────────────────────────────────────────────────────

/**
 * Constant-time string comparison, so a wrong token cannot be discovered a
 * character at a time from response timing.
 */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // timingSafeEqual requires equal lengths; hash first so that length itself
  // is not the thing being compared.
  const ah = crypto.createHash("sha256").update(ab).digest();
  const bh = crypto.createHash("sha256").update(bb).digest();
  return crypto.timingSafeEqual(ah, bh);
}

/**
 * Runs the MCP server over HTTP/SSE.
 *
 * This process holds LELU_API_KEY and authenticates to the engine on its
 * caller's behalf, so every tool it exposes — including `lelu_mint_token`,
 * which mints real signed agent tokens — is reachable by whoever can reach
 * this port. Listening without checking a credential therefore made this an
 * unauthenticated proxy onto the authenticated engine API: anyone who could
 * reach the host could list the tools and mint tokens with no credential of
 * their own.
 *
 * MCP_AUTH_TOKEN is required for that reason, and startup fails without it
 * rather than falling back to open. The bind address also defaults to
 * loopback: a deployment that wants this reachable from elsewhere should say
 * so deliberately via MCP_BIND_ADDR.
 *
 * The stdio transport is unaffected — there the peer is the process that
 * spawned this one, which is a different trust situation entirely.
 */
export async function runHttp(cfg?: LeluMcpConfig, port = 3001): Promise<void> {
  const transports: Record<string, SSEServerTransport> = {};

  const authToken = (process.env["MCP_AUTH_TOKEN"] ?? "").trim();
  if (!authToken) {
    throw new Error(
      "[lelu-mcp] MCP_AUTH_TOKEN is required for the HTTP/SSE transport. " +
      "This server holds the engine's API key and mints agent tokens on behalf of its callers, " +
      "so an unauthenticated listener hands those capabilities to anyone who can reach the port. " +
      "Set MCP_AUTH_TOKEN to a strong secret, or use the stdio transport (--transport stdio)."
    );
  }
  if (authToken.length < 16) {
    throw new Error("[lelu-mcp] MCP_AUTH_TOKEN must be at least 16 characters.");
  }

  const bindAddr = process.env["MCP_BIND_ADDR"] ?? "127.0.0.1";

  /** Extracts the presented bearer token from the request. */
  const presentedToken = (req: http.IncomingMessage): string => {
    const header = req.headers["authorization"];
    if (typeof header === "string" && header.startsWith("Bearer ")) {
      return header.slice("Bearer ".length).trim();
    }
    const alt = req.headers["x-lelu-mcp-token"];
    return typeof alt === "string" ? alt.trim() : "";
  };

  const httpServer = http.createServer(async (req, res) => {
    // CORS. Credentials are never reflected and the allowed origin stays
    // wildcard only because no cookie or credentialed request is involved —
    // authentication here is an explicit header the caller must supply.
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Lelu-MCP-Token");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    // Health probe (used by Docker healthcheck). Deliberately unauthenticated
    // and deliberately says nothing beyond liveness.
    if (req.url === "/healthz" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", service: "lelu-mcp" }));
      return;
    }

    // Everything below this line reaches the engine under LELU_API_KEY.
    const token = presentedToken(req);
    if (!token || !safeEqual(token, authToken)) {
      res.writeHead(401, {
        "Content-Type": "application/json",
        "WWW-Authenticate": 'Bearer realm="lelu-mcp"',
      });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }

    // SSE endpoint — agent opens GET /sse to establish a session
    if (req.url === "/sse" && req.method === "GET") {
      const server    = createLeluMcpServer(cfg);
      const transport = new SSEServerTransport("/messages", res);
      transports[transport.sessionId] = transport;
      res.on("close", () => { delete transports[transport.sessionId]; });
      await server.connect(transport);
      return;
    }

    // Messages endpoint — agent POSTs to /messages?sessionId=<id>
    if (req.url?.startsWith("/messages") && req.method === "POST") {
      const sessionId = new URL(req.url, "http://x").searchParams.get("sessionId") ?? "";
      const transport = transports[sessionId];
      if (!transport) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "session not found" }));
        return;
      }
      await transport.handlePostMessage(req, res);
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => httpServer.listen(port, bindAddr, resolve));
  console.error(`[lelu-mcp] HTTP/SSE server listening on http://${bindAddr}:${port}`);
  console.error(`[lelu-mcp]   SSE endpoint  : GET  /sse            (requires Authorization: Bearer <MCP_AUTH_TOKEN>)`);
  console.error(`[lelu-mcp]   Post endpoint : POST /messages?sessionId=<id>  (same)`);
  console.error(`[lelu-mcp]   Health check  : GET  /healthz        (open)`);
  if (bindAddr === "0.0.0.0") {
    console.error(`[lelu-mcp] WARNING: bound to 0.0.0.0 — this port fronts the engine's API key. Ensure MCP_AUTH_TOKEN is strong and the port is firewalled.`);
  }

  // Keep alive
  await new Promise<void>((_, reject) => httpServer.on("error", reject));
}
