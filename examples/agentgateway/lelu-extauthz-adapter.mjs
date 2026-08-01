// Lelu ↔ agentgateway external-authorization adapter.
//
// agentgateway's HTTP ext_authz contract: 2xx = allow, non-2xx = deny. Lelu's
// engine returns 200 with the decision in the JSON body, so this thin adapter
// translates a Lelu decision into the status code agentgateway expects, and
// surfaces the decision/reason/trace as response headers.
//
//   node lelu-extauthz-adapter.mjs           # listens on :9000
//
// Zero dependencies (Node 18+). Point agentgateway's extAuthz.host at it.

import http from "node:http";

const LELU = process.env.LELU_URL ?? "http://localhost:8088";
const KEY = process.env.LELU_API_KEY ?? "lelu-dev-key";
const PORT = Number(process.env.PORT ?? 9000);

const server = http.createServer(async (req, res) => {
  // agentgateway forwards the original request. The agent identity, action, and
  // (optionally) the verified confidence are read from headers — set these from
  // JWT claims / your gateway policy, or have the SDK attach them upstream.
  const actor = req.headers["x-lelu-actor"];
  const action = req.headers["x-lelu-action"] ?? req.url.replace(/^\/+/, "");
  const confidence = req.headers["x-lelu-confidence"];

  const body = { action };
  if (actor) body.actor = actor;
  if (confidence !== undefined) body.confidence = Number(confidence);

  try {
    const r = await fetch(`${LELU}/v1/agent/authorize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();

    const decision = d.compute
      ? "compute"
      : d.requires_human_review
      ? "human_review"
      : d.downgraded_scope
      ? "downgraded"
      : d.allowed
      ? "allow"
      : "deny";

    res.setHeader("x-lelu-decision", decision);
    if (d.reason) res.setHeader("x-lelu-reason", d.reason);
    if (d.trace_id) res.setHeader("x-lelu-trace-id", d.trace_id);
    if (d.downgraded_scope) res.setHeader("x-lelu-downgraded-scope", d.downgraded_scope);

    // Only a clean allow lets the original action through the gateway.
    // `d.allowed` is also true for a scope downgrade (e.g. "read_only") — the
    // gateway has no way to re-run the proxied request under a restricted
    // scope, so a downgrade must be blocked here exactly like compute/review/
    // deny; the safe alternative / restricted-scope call is handled out of band.
    if (d.allowed && !d.requires_human_review && !d.compute && !d.downgraded_scope) {
      res.writeHead(200);
      res.end("ok");
    } else {
      res.writeHead(403);
      res.end(d.reason ?? "denied");
    }
  } catch (err) {
    // Fail closed: if the decision engine is unreachable, deny.
    res.setHeader("x-lelu-decision", "deny");
    res.writeHead(403);
    res.end("authorization unavailable");
  }
});

server.listen(PORT, () => {
  console.log(`Lelu ext_authz adapter listening on :${PORT} → ${LELU}`);
});
