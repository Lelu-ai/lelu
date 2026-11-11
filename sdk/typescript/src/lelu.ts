// Shared-instance entry point.
//
// One `lelu(options)` call in a shared module (e.g. lib/lelu.ts) produces the
// instance the rest of the app imports — full engine access via `auth.api.*`,
// a default actor via `auth.authorize()`, and a fetch-style `auth.handler`
// that mounts in any Web-standard framework route (Next.js, Hono, Bun, Deno).

import { LeluClient } from "./client.js";
import { AuthEngineError } from "./types.js";
import type { AuthDecision, AuthorizeRequest, ClientConfig } from "./types.js";

/** The caller of `auth.handler`, as your app's own authentication sees it. */
export interface HandlerCaller {
  /**
   * The human this caller is, when they may review queued actions. Required
   * to list, approve or deny, and recorded as the resolver — the request body
   * can't choose it. Leave it unset for callers who may only authorize.
   */
  reviewer?: string;
}

export interface LeluOptions extends ClientConfig {
  /** Default actor applied to `auth.authorize()` calls that omit one. */
  actor?: string;
  /** Path prefix `auth.handler` is mounted under (default: "/api/lelu"). */
  basePath?: string;
  /**
   * Authenticates each `auth.handler` request with your app's own auth
   * (session, JWT, …). Return the caller, or `null` to refuse with 401.
   *
   * Required for every route except `GET /ok`. The handler calls the engine
   * with this instance's API key, so without a check here anyone who can
   * reach the route could authorize as your agents or approve their actions.
   */
  authenticate?: (request: Request) => HandlerCaller | null | Promise<HandlerCaller | null>;
  /**
   * One of the engine's `LELU_REVIEWER_KEYS` secrets, sent when the handler
   * approves or denies. Needed when the engine sets `LELU_REVIEWER_KEYS`; the
   * engine then records the reviewer named by this key, so put the human's
   * name in your note if the key is shared.
   */
  reviewerKey?: string;
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
//   POST {basePath}/authorize            body: AuthorizeRequest → AuthDecision   (authenticated)
//   GET  {basePath}/queue                → { items, count }                     (reviewer)
//   POST {basePath}/queue/:id/approve    body: { note? }                         (reviewer)
//   POST {basePath}/queue/:id/deny      body: { note? }                         (reviewer)
//   GET  {basePath}/ok                  → { ok }                                (anyone)

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function route(
  api: LeluClient,
  authorize: (req: AuthorizeRequest) => Promise<AuthDecision>,
  authenticate: LeluOptions["authenticate"],
  reviewerKey: string | undefined,
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

  if (method === "GET" && segments.length === 1 && segments[0] === "ok") {
    return json({ ok: await api.isHealthy() });
  }

  // Everything else acts with this instance's engine credentials, so it is
  // only served to a caller the app has authenticated.
  if (!authenticate) {
    return json(
      {
        error: "handler_not_configured",
        message: "auth.handler needs an `authenticate` option before it serves anything but /ok",
      },
      403
    );
  }
  const caller = await authenticate(request);
  if (!caller) {
    return json({ error: "unauthenticated" }, 401);
  }
  const reviewer = caller.reviewer?.trim();

  if (method === "POST" && segments.length === 1 && segments[0] === "authorize") {
    const body = (await request.json()) as AuthorizeRequest;
    return json(await authorize(body));
  }

  const isQueue = segments[0] === "queue";
  if (isQueue && !reviewer) {
    return json({ error: "forbidden", message: "only a reviewer may use the review queue" }, 403);
  }

  if (method === "GET" && segments.length === 1 && isQueue) {
    return json(await api.listQueue());
  }

  if (method === "POST" && segments.length === 3 && isQueue) {
    const id = segments[1] as string;
    const verb = segments[2];
    // The resolver is the authenticated reviewer. A resolvedBy in the body
    // is ignored: taking it from there let any caller name any reviewer.
    const body = (await request.json().catch(() => ({}))) as { note?: string };
    const opts = { reviewerKey };
    if (verb === "approve") {
      return json(await api.approveQueueItem(id, reviewer as string, body.note ?? "", opts));
    }
    if (verb === "deny") {
      return json(await api.denyQueueItem(id, reviewer as string, body.note ?? "", opts));
    }
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
  const { actor, basePath: rawBasePath, authenticate, reviewerKey, ...clientConfig } = options;
  const api = new LeluClient(clientConfig);
  const basePath = (rawBasePath ?? "/api/lelu").replace(/\/+$/, "");

  const authorize = (req: AuthorizeRequest): Promise<AuthDecision> =>
    api.authorize({
      ...req,
      ...(req.actor === undefined && actor !== undefined ? { actor } : {}),
    });

  const handler = async (request: Request): Promise<Response> => {
    try {
      return await route(api, authorize, authenticate, reviewerKey, basePath, request);
    } catch (err) {
      if (err instanceof AuthEngineError) {
        return json({ error: err.message, details: err.details }, err.status ?? 502);
      }
      return json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  };

  return { options, api, authorize, handler };
}
