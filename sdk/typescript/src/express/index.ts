import type { Request, Response, NextFunction, RequestHandler } from "express";
import { LeluClient } from "../client.js";
import type { LeluInstance } from "../lelu.js";

export interface AuthorizeOptions {
  /** Base URL of the Lelu engine (default: http://localhost:8080) */
  baseUrl?: string;
  /** API key for the Lelu engine */
  apiKey?: string;
  /** HTTP header that carries the actor identifier (default: x-actor) */
  actorHeader?: string;
  /** Confidence score (0.0–1.0). Omit to let engine apply MissingSignalMode. */
  confidence?: number;
  /** Explicit LeluClient or lelu() instance (overrides baseUrl/apiKey) */
  client?: LeluClient | LeluInstance;
}

function resolveClient(client: LeluClient | LeluInstance): LeluClient {
  return client instanceof LeluClient ? client : client.api;
}

/**
 * Express middleware factory that calls the Lelu engine and either calls
 * `next()` (allowed) or returns a 403 JSON response (denied / human_review).
 *
 * ```ts
 * import express from "express";
 * import { authorize } from "lelu-agent-auth/express";
 * import { auth } from "./lib/lelu";
 *
 * const app = express();
 * app.get("/sensitive", authorize("files.read", { client: auth, confidence: 0.9 }), handler);
 * ```
 */
export function authorize(action: string, opts: AuthorizeOptions = {}): RequestHandler {
  const clientConfig: { baseUrl: string; apiKey?: string } = {
    baseUrl: opts.baseUrl ?? process.env["LELU_BASE_URL"] ?? "http://localhost:8080",
  };
  const apiKey = opts.apiKey ?? process.env["LELU_API_KEY"];
  if (apiKey !== undefined) {
    clientConfig.apiKey = apiKey;
  }
  const client = opts.client ? resolveClient(opts.client) : new LeluClient(clientConfig);

  const actorHeader = opts.actorHeader ?? "x-actor";
  const confidence = opts.confidence; // undefined → engine applies MissingSignalMode

  return async function leluAuthorize(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const actor = (req.headers[actorHeader] as string | undefined) ?? "anonymous";

    try {
      const decision = await client.agentAuthorize({
        actor,
        action,
        context: { ...(confidence !== undefined ? { confidence } : {}) },
      });

      // `allowed` is also true for a scope downgrade or a compute redirect —
      // neither means "let the original route handler run unrestricted."
      // Only a clean allow calls next(); everything else is blocked here.
      if (decision.allowed && !decision.downgradedScope && !decision.computed) {
        // Attach decision to request for downstream handlers
        (req as Request & { leluDecision: typeof decision }).leluDecision = decision;
        next();
        return;
      }

      res.status(403).json({
        error: "forbidden",
        decision: decision.allowed,
        reason: decision.reason ?? "denied by policy",
        downgradedScope: decision.downgradedScope,
        computed: decision.computed,
        safeTool: decision.safeTool,
        actor,
        action,
      });
    } catch (err) {
      res.status(503).json({
        error: "lelu_unavailable",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };
}

/**
 * Converts a lelu() instance's fetch-style handler into an Express handler,
 * so the authorize/review-queue/health routes can be served from an Express
 * app instead of a Web-standard framework.
 *
 * ```ts
 * import { toNodeHandler } from "lelu-agent-auth/express";
 * import { auth } from "./lib/lelu";
 *
 * app.all("/api/lelu/*", toNodeHandler(auth));
 * ```
 *
 * Mount it BEFORE express.json() (or on a path that middleware skips) if you
 * want the raw body passed through untouched; a parsed `req.body` is
 * re-serialized automatically.
 */
export function toNodeHandler(auth: LeluInstance): RequestHandler {
  return async function leluHandler(req: Request, res: Response): Promise<void> {
    const protocol = req.protocol || "http";
    const host = req.get("host") ?? "localhost";
    const url = `${protocol}://${host}${req.originalUrl}`;

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers.set(key, value);
      else if (Array.isArray(value)) headers.set(key, value.join(", "));
    }

    let body: string | undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      if (req.body !== undefined) {
        body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      } else {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        if (chunks.length > 0) body = Buffer.concat(chunks).toString("utf8");
      }
    }

    const response = await auth.handler(
      new Request(url, {
        method: req.method,
        headers,
        ...(body !== undefined ? { body } : {}),
      })
    );

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.send(await response.text());
  };
}
