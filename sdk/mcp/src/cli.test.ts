import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as http from "node:http";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// Runs the real CLI entry point (through vite-node, so no build is needed).
const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteNode = path.join(pkgDir, "node_modules", ".bin", process.platform === "win32" ? "vite-node.cmd" : "vite-node");

function runCli(args: string[], env: Record<string, string>, cwd = pkgDir) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const base = { ...process.env };
    delete base["LELU_ENGINE_URL"];
    delete base["LELU_API_KEY"];
    const child = spawn(viteNode, ["--root", pkgDir, path.join(pkgDir, "src", "cli.ts"), ...args], {
      cwd,
      env: { ...base, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin.end(); // a stdio server that did start exits on end of input
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => { stdout += c; });
    child.stderr.on("data", (c: Buffer) => { stderr += c; });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "lelu-mcp-cli-")); });
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("lelu-mcp start", () => {
  it("exits with the reason when the local engine can't start, instead of using another engine", async () => {
    const res = await runCli(["start"], {
      LELU_HOME: dir,
      LELU_ENGINE_BINARY: path.join(dir, "missing-engine"),
    });
    expect(res.code).toBe(1);
    expect(res.stderr).toMatch(/Could not start a local engine: LELU_ENGINE_BINARY points to a missing file/);
    expect(res.stderr).toMatch(/--engine-url/);
    expect(res.stderr).not.toMatch(/Using the engine already running/);
    expect(res.stderr).not.toMatch(/Starting MCP server/);
  }, 60_000);

  it("does not fall back to an engine that happens to answer on localhost:8082", async () => {
    let hits = 0;
    const server = http.createServer((_req, res) => {
      hits++;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end('{"status":"ok"}');
    });
    const listening = await new Promise<boolean>((resolve) => {
      server.once("error", () => resolve(false));
      server.listen(8082, "::", () => resolve(true)); // dual-stack: answers 127.0.0.1 and ::1
    });
    if (!listening) return; // port taken on this machine; the test above still covers the exit
    try {
      const res = await runCli(["start"], {
        LELU_HOME: dir,
        LELU_ENGINE_BINARY: path.join(dir, "missing-engine"),
      });
      expect(res.code).toBe(1);
      expect(res.stderr).not.toMatch(/Starting MCP server/);
      expect(hits).toBe(0);
    } finally {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    }
  }, 60_000);
});

describe("lelu-mcp add", () => {
  it("--cursor prints the stdio config with the coding-agent preset and says where it goes", async () => {
    const res = await runCli(["add", "--cursor"], {}, dir);
    expect(res.code).toBe(0);
    expect(JSON.parse(res.stdout)).toEqual({
      mcpServers: {
        lelu: { command: "npx", args: ["-y", "lelu-mcp", "start", "--transport", "stdio", "--preset", "coding-agent"] },
      },
    });
    expect(res.stderr).toMatch(/\.cursor\/mcp\.json/);
    expect(fs.existsSync(path.join(dir, ".cursor"))).toBe(false);
  }, 60_000);

  it("--open-code --write creates ./opencode.json", async () => {
    const res = await runCli(["add", "--open-code", "--write"], {}, dir);
    expect(res.code).toBe(0);
    const written = JSON.parse(fs.readFileSync(path.join(dir, "opencode.json"), "utf8"));
    expect(written.mcp.servers.lelu.command).toContain("coding-agent");
  }, 60_000);

  it("exits 1 on a bad --mode", async () => {
    const res = await runCli(["add", "--cursor", "--mode", "http"], {}, dir);
    expect(res.code).toBe(1);
    expect(res.stderr).toMatch(/--mode must be 'stdio' or 'sse'/);
  }, 60_000);
});
