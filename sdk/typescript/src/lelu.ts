// Shared-instance entry point.
//
// One `lelu(options)` call in a shared module (e.g. lib/lelu.ts) produces the
// instance the rest of the app imports — full engine access via `auth.api.*`,
// a default actor via `auth.authorize()`, and a fetch-style `auth.handler`
// that mounts in any Web-standard framework route (Next.js, Hono, Bun, Deno).

import { LeluClient } from "./client.js";
import { AuthEngineError } from "./types.js";
import type { AuthDecision, AuthorizeRequest, ClientConfig } from "./types.js";

export interface LeluOptions extends ClientConfig {
  /** Default actor applied to `auth.authorize()` calls that omit one. */
  actor?: string;
  /** Path prefix `auth.handler` is mounted under (default: "/api/lelu"). */
  basePath?: string;
}

export interface LeluInstance {
  /** The options this instance was created with. */
  options: LeluOptions;
  /** Full engine API — every LeluClient method (`auth.api.mintToken(...)`, …). */
  api: LeluClient;
  /**
   * Authorizes a tool call, filling in the instance's default `actor` when
   * the request doesn't name one.
   */
  authorize(req: AuthorizeRequest): Promise<AuthDecision>;
  /**
   * Fetch-style handler (`Request → Response`) exposing the engine's
   * authorize / review-queue / health endpoints under `basePath`, so browser
   * code (e.g. an approval UI) never sees the engine URL or API key.
   *
   * ```ts
   * // app/api/lelu/[...all]/route.ts (Next.js)
   * import { auth } from "@/lib/lelu";
   * export const GET = auth.handler;
   * export const POST = auth.handler;
   * ```
   */
  handler(request: Request): Promise<Response>;
}

// ─── Handler routes ───────────────────────────────────────────────────────────
//
//   POST {basePath}/authorize            body: AuthorizeRequest → AuthDecision
//   GET  {basePath}/queue                → { items, count }
//   POST {basePath}/queue/:id/approve    body: { resolvedBy?, note? }
//   POST {basePath}/queue/:id/deny      body: { resolvedBy?, note? }
//   GET  {basePath}/ok                  → { ok }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function route(
  api: LeluClient,
  authorize: (req: AuthorizeRequest) => Promise<AuthDecision>,
  basePath: string,
  request: Request
): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname !== basePath && !pathname.startsWith(`${basePath}/`)) {
    return json({ error: "not_found" }, 404);
  }
  const rest = pathname.slice(basePath.length).replace(/^\/+|\/+$/g, "");
  const segments = rest === "" ? [] : rest.split("/");
  const method = request.method.toUpperCase();

  if (method === "POST" && segments.length === 1 && segments[0] === "authorize") {
    const body = (await request.json()) as AuthorizeRequest;
    return json(await authorize(body));
  }

  if (method === "GET" && segments.length === 1 && segments[0] === "queue") {
    return json(await api.listQueue());
  }

  if (method === "POST" && segments.length === 3 && segments[0] === "queue") {
    const id = segments[1] as string;
    const verb = segments[2];
    const body = (await request.json().catch(() => ({}))) as {
      resolvedBy?: string;
      note?: string;
    };
    const resolvedBy = body.resolvedBy ?? "handler";
    if (verb === "approve") {
      return json(await api.approveQueueItem(id, resolvedBy, body.note ?? ""));
    }
    if (verb === "deny") {
      return json(await api.denyQueueItem(id, resolvedBy, body.note ?? ""));
    }
  }

  if (method === "GET" && segments.length === 1 && segments[0] === "ok") {
    return json({ ok: await api.isHealthy() });
  }

  return json({ error: "not_found" }, 404);
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates the app-wide Lelu instance. Call it once in a shared module and
 * import the result everywhere.
 *
 * @example
 * ```ts
 * // lib/lelu.ts
 * import { lelu } from "lelu-agent-auth";
 *
 * export const auth = lelu({
 *   apiKey: process.env.LELU_API_KEY,
 *   actor: "billing-agent",
 * });
 *
 * // anywhere on the server
 * const decision = await auth.authorize({ tool: "refund:process" });
 * if (!decision.allowed) throw new Error(decision.reason);
 * ```
 */
export function lelu(options: LeluOptions = {}): LeluInstance {
  const { actor, basePath: rawBasePath, ...clientConfig } = options;
  const api = new LeluClient(clientConfig);
  const basePath = (rawBasePath ?? "/api/lelu").replace(/\/+$/, "");

  const authorize = (req: AuthorizeRequest): Promise<AuthDecision> =>
    api.authorize({
      ...req,
      ...(req.actor === undefined && actor !== undefined ? { actor } : {}),
    });

  const handler = async (request: Request): Promise<Response> => {
    try {
      return await route(api, authorize, basePath, request);
    } catch (err) {
      if (err instanceof AuthEngineError) {
        return json({ error: err.message, details: err.details }, err.status ?? 502);
      }
      return json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  };

  return { options, api, authorize, handler };
}
