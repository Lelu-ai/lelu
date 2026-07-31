#!/usr/bin/env node

/*
 * Lelu CLI
 *
 * Provides audit log viewing and policy management utilities.
 */

const { spawnSync } = require("node:child_process");
const path = require("node:path");

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: false,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed with code ${result.status}`);
  }
}

function showAuditLog() {
  const auditScript = path.join(__dirname, "audit-log.js");
  run("node", [auditScript]);
}

function showPolicies() {
  const policiesScript = path.join(__dirname, "policies.js");
  const args = process.argv.slice(3); // Pass remaining args to policies script
  run("node", [policiesScript, ...args]);
}

function printHelp() {
  console.log(`
Lelu CLI

Usage:
  lelu audit-log         View recent audit events
  lelu policies          Manage authorization policies
  lelu help              Show this help

Commands:
  audit-log              View audit trail and authorization events

  policies list          List all policies
  policies get <name>    Get a specific policy
  policies set <name> <file>  Create or update a policy from file
  policies delete <name> Delete a policy

Environment Variables:
  LELU_PLATFORM_URL       Platform API URL (default: http://localhost:9091)
  LELU_PLATFORM_API_KEY   Platform API key (default: platform-dev-key)
  LELU_ENGINE_URL         Engine API URL (default: http://localhost:8083)
  LELU_TENANT_ID          Tenant ID (default: default)
  LELU_AUDIT_LIMIT        Number of events to fetch (default: 20)

Examples:
  lelu audit-log                              # View recent audit events
  lelu policies list                          # List all policies
  lelu policies get auth                      # View the "auth" policy
  lelu policies set auth ./auth.rego          # Create/update policy from file
  LELU_TENANT_ID=prod lelu policies list      # Use different tenant

For visual UI dashboard:
  Use Docker: docker run -p 3002:3002 abenezer0923/lelu-platform:latest
  Or visit: https://lelu-ai.com/
`);
}

function main() {
  const command = process.argv[2] || "help";

  if (command === "audit-log") {
    showAuditLog();
    return;
  }

  if (command === "policies") {
    showPolicies();
    return;
  }

  if (command === "help" || command === "-h" || command === "--help") {
    printHelp();
    return;
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}

main();
