import type { Request, Response, NextFunction, RequestHandler } from "express";
import { LeluClient } from "../client";

export interface AuthorizeOptions {
  /** Base URL of the Lelu engine (default: http://localhost:8080) */
  baseUrl?: string;
  /** API key for the Lelu engine */
  apiKey?: string;
  /** HTTP header that carries the actor identifier (default: x-actor) */
  actorHeader?: string;
  /** Confidence score to pass to the engine (default: 1.0) */
  confidence?: number;
  /** Explicit LeluClient instance (overrides baseUrl/apiKey) */
  client?: LeluClient;
}

/**
 * Express middleware factory that calls the Lelu engine and either calls
 * `next()` (allowed) or returns a 403 JSON response (denied / human_review).
 *
 * ```ts
 * import express from "express";
 * import { authorize } from "lelu-agent-auth/express";
 *
 * const app = express();
 * app.get("/sensitive", authorize("files.read", { confidence: 0.9 }), handler);
 * ```
 */
export function authorize(action: string, opts: AuthorizeOptions = {}): RequestHandler {
  const clientConfig: any = {
    baseUrl: opts.baseUrl ?? process.env["LELU_BASE_URL"] ?? "http://localhost:8080",
  };
  const apiKey = opts.apiKey ?? process.env["LELU_API_KEY"];
  if (apiKey !== undefined) {
    clientConfig.apiKey = apiKey;
  }
  const client = opts.client ?? new LeluClient(clientConfig);

  const actorHeader = opts.actorHeader ?? "x-actor";
  const confidence = opts.confidence ?? 1.0;

  return async function leluAuthorize(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const actor = (req.headers[actorHeader] as string | undefined) ?? "anonymous";

    try {
      const decision = await client.agentAuthorize({ actor, action, context: { confidence } });

      if (decision.allowed) {
        // Attach decision to request for downstream handlers
        (req as Request & { leluDecision: typeof decision }).leluDecision = decision;
        next();
        return;
      }

      res.status(403).json({
        error: "forbidden",
        decision: decision.allowed,
        reason: decision.reason ?? "denied by policy",
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
