// Lelu-authorized Model Context Protocol (MCP) Server.
//
// Intercepts every MCP tools/call request and validates it against the
// Lelu Authorization Engine before execution.
//
// Decisions:
//   - ALLOW: Tool executes normally.
//   - HUMAN_REVIEW: Tool pauses execution and requests human supervisor confirmation.
//   - DENY / UNREACHABLE: Tool is blocked (Fail-Closed principle).
//
// Usage:
//   node server.mjs
//
// Zero external runtime dependencies (Node 18+ stdio MCP protocol).

import readline from "node:readline";

function getLeluUrl() {
  return process.env.LELU_URL ?? "http://localhost:8080";
}

function getLeluApiKey() {
  return process.env.LELU_API_KEY ?? "lelu-dev-key";
}

function getActorId() {
  return process.env.LELU_ACTOR_ID ?? "claude-code-agent";
}

// Define available tools with risk categories
const TOOLS = [
  {
    name: "read_customer_data",
    description: "Read customer profile and account details (Low Risk)",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: { type: "string", description: "Customer ID to look up" },
      },
      required: ["customer_id"],
    },
  },
  {
    name: "issue_refund",
    description: "Issue a monetary refund to a customer account (Medium/High Risk — Requires Review)",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: { type: "string", description: "Customer ID to refund" },
        amount_usd: { type: "number", description: "Amount in USD to refund" },
        reason: { type: "string", description: "Business reason for the refund" },
      },
      required: ["customer_id", "amount_usd", "reason"],
    },
  },
  {
    name: "delete_production_database",
    description: "Drop customer database tables (Critical Risk — Forbidden)",
    inputSchema: {
      type: "object",
      properties: {
        table_name: { type: "string", description: "Database table to drop" },
        force: { type: "boolean", description: "Force deletion" },
      },
      required: ["table_name"],
    },
  },
];

/**
 * Call Lelu Authorize API to evaluate a tool execution request.
 */
export async function authorizeToolCall(toolName, args, actor = getActorId()) {
  const body = {
    action: `tool:${toolName}`,
    actor,
    context: {
      mcp_tool: toolName,
      arguments: args,
    },
  };

  try {
    const res = await fetch(`${getLeluUrl()}/v1/agent/authorize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getLeluApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return { allowed: false, decision: "deny", reason: `Lelu HTTP ${res.status}: ${res.statusText}` };
    }

    const data = await res.json();
    const decision = data.requires_human_review
      ? "human_review"
      : data.downgraded_scope
      ? "downgraded"
      : data.compute
      ? "compute"
      : data.allowed
      ? "allow"
      : "deny";

    return {
      // `allowed: true` alone isn't enough — Lelu represents a downgraded-scope
      // and a compute redirect the same way on the wire as a clean allow (see
      // engine/CHANGELOG.md). Executing the original tool/args on either would
      // run it at full, unrestricted scope. compute in particular carries its
      // own replacement tool/args (safe_tool/safe_args) that must be used
      // instead of the ones the caller asked for.
      allowed: Boolean(data.allowed && !data.requires_human_review && !data.downgraded_scope && !data.compute),
      decision,
      requires_human_review: Boolean(data.requires_human_review),
      downgraded_scope: data.downgraded_scope,
      compute: Boolean(data.compute),
      safe_tool: data.safe_tool,
      safe_args: data.safe_args,
      reason: data.reason ?? "Policy evaluated by Lelu",
      trace_id: data.trace_id,
    };
  } catch (err) {
    // Fail closed: if Lelu engine is unreachable or offline, default to deny
    return {
      allowed: false,
      decision: "deny",
      reason: `Authorization unavailable (Fail-Closed): ${err.message}`,
    };
  }
}

/**
 * Mock business execution for approved tools.
 */
function executeTool(toolName, args) {
  switch (toolName) {
    case "read_customer_data":
      return {
        customer_id: args.customer_id,
        name: "Acme Corp",
        tier: "Enterprise",
        active_subscriptions: ["pro_plan_annual"],
      };
    case "issue_refund":
      return {
        status: "refund_processed",
        refund_id: "ref_984729104",
        amount_usd: args.amount_usd,
        customer_id: args.customer_id,
      };
    case "delete_production_database":
      return {
        status: "deleted",
        table: args.table_name,
      };
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * Main stdio JSON-RPC MCP message dispatcher.
 */
async function handleMessage(msg) {
  const { id, method, params } = msg;

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: {
          name: "lelu-authorized-mcp-server",
          version: "0.1.0",
        },
      },
    };
  }

  if (method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: { tools: TOOLS },
    };
  }

  if (method === "tools/call") {
    const toolName = params?.name;
    const args = params?.arguments ?? {};

    // 1. Intercept and Authorize with Lelu
    const authResult = await authorizeToolCall(toolName, args);

    if (!authResult.allowed) {
      if (authResult.requires_human_review) {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            isError: true,
            content: [
              {
                type: "text",
                text: `⏸️ [LELU HUMAN REVIEW REQUIRED] Tool '${toolName}' execution paused pending approval.\nReason: ${authResult.reason}\nTrace ID: ${authResult.trace_id ?? "none"}`,
              },
            ],
          },
        };
      }

      if (authResult.compute) {
        // Lelu redirected this call to a safer tool/args instead of the ones
        // requested — run those, not the original. Never fall back to
        // toolName/args here: that would execute the exact call Lelu decided
        // was unsafe as originally requested.
        try {
          const output = executeTool(authResult.safe_tool, authResult.safe_args ?? {});
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `🧪 [LELU COMPUTE REDIRECT] '${toolName}' was redirected to '${authResult.safe_tool}' by policy.\nReason: ${authResult.reason}\n\n${JSON.stringify(output, null, 2)}`,
                },
              ],
            },
          };
        } catch (err) {
          return {
            jsonrpc: "2.0",
            id,
            result: {
              isError: true,
              content: [{ type: "text", text: `🧪 [LELU COMPUTE REDIRECT] '${toolName}' was redirected to '${authResult.safe_tool}', but it failed: ${err.message}` }],
            },
          };
        }
      }

      return {
        jsonrpc: "2.0",
        id,
        result: {
          isError: true,
          content: [
            {
              type: "text",
              text: `🚫 [LELU ACCESS DENIED] Authorization rejected for tool '${toolName}'.\nDecision: ${authResult.decision.toUpperCase()}\nReason: ${authResult.reason}`,
            },
          ],
        },
      };
    }

    // 2. Execute Authorized Tool
    try {
      const output = executeTool(toolName, args);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(output, null, 2),
            },
          ],
        },
      };
    } catch (err) {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          isError: true,
          content: [{ type: "text", text: `Tool error: ${err.message}` }],
        },
      };
    }
  }

  // Unsupported or notification method
  if (id !== undefined) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    };
  }
  return null;
}

// Start stdio reader if run directly
if (process.argv[1]?.endsWith("server.mjs")) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const msg = JSON.parse(trimmed);
      const res = await handleMessage(msg);
      if (res) {
        process.stdout.write(JSON.stringify(res) + "\n");
      }
    } catch (err) {
      process.stderr.write(`[lelu-mcp] Error: ${err.message}\n`);
    }
  });

  process.stderr.write("[lelu-mcp] Lelu-authorized MCP server listening on stdio\n");
}
