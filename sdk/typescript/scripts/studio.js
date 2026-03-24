#!/usr/bin/env node

/**
 * Lelu Studio - Visual UI for managing policies and viewing audit logs
 * 
 * this launches a local web server with the Lelu UI
 * for interactively managing your authorization policies and viewing audit trails.
 */

const { spawn, spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");
const http = require("node:http");

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  port: 3002,
  browser: process.env.BROWSER || null,
  noBrowser: false,
  docker: null, // auto-detect
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "-p" || arg === "--port") {
    options.port = parseInt(args[++i], 10);
  } else if (arg === "-b" || arg === "--browser") {
    options.browser = args[++i];
  } else if (arg === "--no-browser") {
    options.noBrowser = true;
  } else if (arg === "--docker") {
    options.docker = true;
  } else if (arg === "--no-docker") {
    options.docker = false;
  } else if (arg === "-h" || arg === "--help") {
    printHelp();
    process.exit(0);
  }
}

function printHelp() {
  console.log(`
Lelu Studio - Visual UI for Authorization Management

Usage:
  lelu studio [options]

Options:
  -p, --port <number>     Port number to start Studio on (default: 3002)
  -b, --browser <name>    Browser to open Studio in (chrome, firefox, safari)
  --no-browser            Don't automatically open browser
  --docker                Use Docker mode (starts all services)
  -h, --help              Show this help

Environment Variables:
  LELU_PLATFORM_URL       Platform API URL (default: http://localhost:9091)
  LELU_PLATFORM_API_KEY   Platform API key (default: platform-dev-key)
  LELU_ENGINE_URL         Engine API URL (default: http://localhost:8083)
  BROWSER                 Browser to open (chrome, firefox, safari)

Examples:
  lelu studio                          # Check Platform API and start
  lelu studio --docker                 # Use Docker mode (all services)
  lelu studio -p 4000                  # Start on custom port
  lelu studio --no-browser             # Start without opening browser

How It Works:
  Lelu Studio works like Prisma Studio - it just needs a Platform API
  to connect to. The Platform API can run:
  
  • Locally with SQLite (no Docker needed)
  • In Docker containers (recommended for full stack)
  • On a remote server (team setup)

Quick Setup:
  1. With Docker (easiest):
     docker-compose up -d
     lelu studio
  
  2. Without Docker (local):
     cd platform && DATABASE_URL=sqlite:./lelu.db go run cmd/api/main.go
     lelu studio
  
  3. Remote API:
     LELU_PLATFORM_URL=https://api.company.com lelu studio
`);
}

function checkDocker() {
  try {
    const result = spawnSync("docker", ["--version"], { stdio: "pipe" });
    return result.status === 0;
  } catch {
    return false;
  }
}

function checkDockerCompose() {
  try {
    const result = spawnSync("docker-compose", ["--version"], { stdio: "pipe" });
    if (result.status === 0) return true;
    
    // Try docker compose (without hyphen)
    const result2 = spawnSync("docker", ["compose", "version"], { stdio: "pipe" });
    return result2.status === 0;
  } catch {
    return false;
  }
}

function findDockerCompose() {
  // Look for docker-compose.yml in current directory and parent directories
  let dir = process.cwd();
  const root = path.parse(dir).root;
  
  while (dir !== root) {
    const composePath = path.join(dir, "docker-compose.yml");
    if (existsSync(composePath)) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  
  return null;
}

function startWithDocker() {
  console.log("🐳 Docker detected - starting Lelu Studio with docker-compose...\n");
  
  const composeDir = findDockerCompose();
  if (!composeDir) {
    console.error("❌ docker-compose.yml not found in current directory or parent directories");
    console.error("   Please run this command from your Lelu project directory\n");
    process.exit(1);
  }
  
  console.log(`📁 Found docker-compose.yml in: ${composeDir}`);
  console.log("🚀 Starting services...\n");
  
  // Start docker-compose
  const composeCmd = checkDockerCompose() ? "docker-compose" : "docker";
  const composeArgs = composeCmd === "docker" ? ["compose", "up", "-d"] : ["up", "-d"];
  
  const result = spawnSync(composeCmd, composeArgs, {
    cwd: composeDir,
    stdio: "inherit",
  });
  
  if (result.status !== 0) {
    console.error("\n❌ Failed to start docker-compose");
    process.exit(1);
  }
  
  console.log("\n✅ Services started successfully!");
  console.log("\n📊 Service URLs:");
  console.log(`   UI:       http://localhost:${options.port}`);
  console.log(`   Platform: http://localhost:9091`);
  console.log(`   Engine:   http://localhost:8083`);
  
  // Wait for UI to be ready
  console.log("\n⏳ Waiting for UI to be ready...");
  waitForService(`http://localhost:${options.port}/healthz`, () => {
    console.log("✅ UI is ready!\n");
    
    if (!options.noBrowser) {
      openBrowser(`http://localhost:${options.port}`);
    } else {
      console.log(`🌐 Open http://localhost:${options.port} in your browser\n`);
    }
    
    console.log("💡 Tip: Press Ctrl+C to stop all services");
    console.log("    Or run: docker-compose down\n");
  });
}

function checkPlatformAPI(url) {
  return new Promise((resolve) => {
    http.get(url + '/healthz', (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => {
      resolve(false);
    });
  });
}

async function startStandalone() {
  console.log("📦 Lelu Studio - Standalone Mode\n");
  
  const platformUrl = process.env.LELU_PLATFORM_URL || 'http://localhost:9091';
  console.log(`🔍 Checking Platform API at ${platformUrl}...`);
  
  const isAvailable = await checkPlatformAPI(platformUrl);
  
  if (!isAvailable) {
    console.log("❌ Platform API not accessible\n");
    console.log("Lelu Studio requires the Platform API to be running.");
    console.log("The Platform API manages policies and audit logs.\n");
    
    console.log("📋 Setup Options:\n");
    
    console.log("Option 1: Quick Start with Docker (Recommended)");
    console.log("  docker-compose up -d");
    console.log("  → Starts Platform API, Engine, Database, and Redis\n");
    
    console.log("Option 2: Run Platform API Locally");
    console.log("  cd platform");
    console.log("  DATABASE_URL=sqlite:./lelu.db go run cmd/api/main.go");
    console.log("  → Starts Platform API with SQLite (no Docker needed)\n");
    
    console.log("Option 3: Connect to Remote API");
    console.log("  LELU_PLATFORM_URL=https://your-api.com lelu studio");
    console.log("  → Connect to existing Platform API\n");
    
    console.log("💡 After starting the Platform API, run 'lelu studio' again\n");
    process.exit(1);
  }
  
  console.log("✅ Platform API is accessible!\n");
  console.log("⚠️  Note: UI server functionality coming soon");
  console.log("   For now, use Docker mode or access UI directly\n");
  
  console.log("📋 Available CLI commands:");
  console.log("  lelu audit-log    View audit events");
  console.log("  lelu policies     Manage policies");
  console.log("  lelu help         Show all commands\n");
  
  console.log("🐳 To use full UI with Docker:");
  console.log("  lelu studio --docker\n");
}

function waitForService(url, callback, maxAttempts = 30) {
  let attempts = 0;
  
  const check = () => {
    attempts++;
    http.get(url, (res) => {
      if (res.statusCode === 200) {
        callback();
      } else if (attempts < maxAttempts) {
        setTimeout(check, 1000);
      } else {
        console.error(`\n❌ Service not ready after ${maxAttempts} seconds`);
        console.error(`   Check logs: docker-compose logs ui\n`);
        process.exit(1);
      }
    }).on("error", () => {
      if (attempts < maxAttempts) {
        setTimeout(check, 1000);
      } else {
        console.error(`\n❌ Service not ready after ${maxAttempts} seconds`);
        console.error(`   Check logs: docker-compose logs ui\n`);
        process.exit(1);
      }
    });
  };
  
  check();
}

function openBrowser(url) {
  const browser = options.browser || process.env.BROWSER;
  
  let command;
  let args = [url];
  
  if (browser) {
    // Use specified browser
    if (process.platform === "darwin") {
      command = "open";
      args = ["-a", browser, url];
    } else if (process.platform === "win32") {
      command = "start";
      args = [browser, url];
    } else {
      command = browser;
    }
  } else {
    // Use default browser
    if (process.platform === "darwin") {
      command = "open";
    } else if (process.platform === "win32") {
      command = "start";
      args = ["", url]; // Empty string for default browser
    } else {
      command = "xdg-open";
    }
  }
  
  try {
    spawn(command, args, {
      detached: true,
      stdio: "ignore",
    }).unref();
    
    console.log(`🌐 Opening ${url} in your browser...\n`);
  } catch (error) {
    console.log(`🌐 Please open ${url} in your browser\n`);
  }
}

function main() {
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║                     Lelu Studio                           ║");
  console.log("║         Visual UI for Authorization Management           ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");
  
  // Check if user explicitly wants Docker mode
  if (options.docker === true) {
    if (!checkDocker() || !checkDockerCompose()) {
      console.error("❌ Docker or docker-compose not found");
      console.error("   Install Docker: https://docs.docker.com/get-docker/\n");
      process.exit(1);
    }
    startWithDocker();
    return;
  }
  
  // Check if user explicitly wants no-Docker mode
  if (options.docker === false) {
    startStandalone();
    return;
  }
  
  // Auto-detect: prefer standalone mode (like Prisma)
  // Docker is optional, not required
  startStandalone();
}

main();
