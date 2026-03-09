#!/usr/bin/env node

/*
 * Lelu CLI
 *
 * Provides a one-command local dashboard bootstrap for SDK users.
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO_URL = "https://github.com/lelu-auth/lelu.git";
const STACK_DIR = path.join(os.homedir(), ".lelu-stack");
const DASHBOARD_URL = "http://localhost:3002/audit";

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

function checkTool(command, name) {
  const check = spawnSync(command, ["--version"], { stdio: "ignore", shell: false });
  if (check.error || check.status !== 0) {
    console.error(`\n${name} is required but was not found in PATH.`);
    process.exit(1);
  }
}

function ensureRepo() {
  if (!fs.existsSync(STACK_DIR)) {
    console.log(`\nCloning Lelu stack into ${STACK_DIR} ...`);
    run("git", ["clone", "--depth", "1", REPO_URL, STACK_DIR]);
    return;
  }

  console.log("\nUpdating local Lelu stack...");
  run("git", ["-C", STACK_DIR, "checkout", "main"]);
  run("git", ["-C", STACK_DIR, "pull", "--ff-only", "origin", "main"]);
}

function startDashboard() {
  checkTool("git", "Git");
  checkTool("docker", "Docker");

  ensureRepo();

  console.log("\nStarting local Lelu dashboard stack (this may take a few minutes)...");
  run("docker", ["compose", "up", "-d", "--build"], { cwd: STACK_DIR });

  console.log("\nLelu dashboard is ready:");
  console.log(`  ${DASHBOARD_URL}`);
  console.log("\nTo stop later:");
  console.log(`  cd ${STACK_DIR}`);
  console.log("  docker compose down");
}

function printHelp() {
  console.log(`
Lelu CLI

Usage:
  lelu dashboard    Start local dashboard stack and print URL
  lelu help         Show this help
`);
}

function main() {
  const command = process.argv[2] || "dashboard";

  if (command === "dashboard") {
    startDashboard();
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
