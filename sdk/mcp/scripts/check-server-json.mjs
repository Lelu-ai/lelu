#!/usr/bin/env node
// Guards against sdk/mcp/server.json drifting from package.json — see
// https://github.com/modelcontextprotocol/registry/issues/1525, where a stale
// packages[].version in server.json made `mcp-publisher publish` validate
// against an old, wrong-cased npm release instead of the current one.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(dir, "..", "package.json"), "utf8"));
const server = JSON.parse(readFileSync(join(dir, "..", "server.json"), "utf8"));

const errors = [];

if (server.version !== pkg.version) {
  errors.push(
    `server.json version "${server.version}" != package.json version "${pkg.version}"`
  );
}

const npmPackage = server.packages?.find((p) => p.registryType === "npm");
if (!npmPackage) {
  errors.push("server.json has no npm entry in packages[]");
} else if (npmPackage.version !== pkg.version) {
  errors.push(
    `server.json packages[].version "${npmPackage.version}" != package.json version "${pkg.version}"`
  );
}

if (server.name !== pkg.mcpName) {
  errors.push(
    `server.json name "${server.name}" != package.json mcpName "${pkg.mcpName}"`
  );
}

if (errors.length > 0) {
  console.error("server.json is out of sync with package.json:\n");
  for (const e of errors) console.error(`  - ${e}`);
  console.error(
    "\nUpdate sdk/mcp/server.json's version, packages[].version, and name to match before publishing."
  );
  process.exit(1);
}

console.log(`server.json matches package.json (${pkg.version}, ${pkg.mcpName}).`);
