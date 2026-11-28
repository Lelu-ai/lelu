import { afterEach, describe, expect, it } from "vitest";
import * as http from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { PassThrough } from "node:stream";
import { createLeluMcpServer, resolveTokenIdArg, runStdio } from "./server.js";

// A stand-in engine that records the requests the MCP tools make.
const servers: http.Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => {
    s.closeAllConnections();
    return new Promise((r) => s.close(r));
  }));
});

async function fakeEngine(): Promise<{ url: string; requests: Array<{ method?: string; url?: string }> }> {
  const requests: Array<{ method?: string; url?: string }> = [];
  const server = http.createServer((req, res) => {
    requests.push({ method: req.method, url: req.url });
    res.writeHead(200, { "Content-Type": "application/json" });
    if (req.method === "POST" && req.url === "/v1/tokens/mint") {
      res.end(JSON.stringify({ token: "jwt", token_id: "tok-123", expires_at: 1_900_000_000 }));
    } else {
      res.end(JSON.stringify({ success: true }));
    }
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, requests };
}

async function connect(engineUrl: string): Promise<Client> {
  const server = createLeluMcpServer({ engineUrl, apiKey: "k" });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(clientSide);
  return client;
}

const text = (r: unknown) => ((r as { content: Array<{ text: string }> }).content[0]!.text);

describe("lelu_revoke_token", () => {
  it("accepts the token_id that lelu_mint_token returns", async () => {
    const engine = await fakeEngine();
    const client = await connect(engine.url);

    const minted = JSON.parse(text(await client.callTool({ name: "lelu_mint_token", arguments: { scope: "read:x" } })));
    expect(minted.token_id).toBe("tok-123");

    const revoked = await client.callTool({ name: "lelu_revoke_token", arguments: { token_id: minted.token_id } });
    expect(revoked.isError).toBeFalsy();
    expect(JSON.parse(text(revoked))).toEqual({ success: true });
    expect(engine.requests.at(-1)).toEqual({ method: "DELETE", url: "/v1/tokens/tok-123" });
  });

  it("still accepts tokenId", async () => {
    const engine = await fakeEngine();
    const client = await connect(engine.url);
    const revoked = await client.callTool({ name: "lelu_revoke_token", arguments: { tokenId: "tok-9" } });
    expect(revoked.isError).toBeFalsy();
    expect(engine.requests.at(-1)).toEqual({ method: "DELETE", url: "/v1/tokens/tok-9" });
  });

  it("reports an error and calls nothing when no token ID is given", async () => {
    const engine = await fakeEngine();
    const client = await connect(engine.url);
    const res = await client.callTool({ name: "lelu_revoke_token", arguments: {} });
    expect(res.isError).toBe(true);
    expect(text(res)).toMatch(/token_id is required/);
    expect(engine.requests).toHaveLength(0);
  });
});

describe("resolveTokenIdArg", () => {
  it("prefers token_id, falls back to tokenId, and rejects conflicting values", () => {
    expect(resolveTokenIdArg({ token_id: "a" })).toBe("a");
    expect(resolveTokenIdArg({ tokenId: "b" })).toBe("b");
    expect(resolveTokenIdArg({ token_id: "a", tokenId: "a" })).toBe("a");
    expect(() => resolveTokenIdArg({ token_id: "a", tokenId: "b" })).toThrow(/different values/);
    expect(() => resolveTokenIdArg({})).toThrow(/token_id is required/);
  });
});

describe("runStdio", () => {
  it("serves requests and resolves once the client closes stdin", async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const out: string[] = [];
    stdout.on("data", (c: Buffer) => out.push(c.toString()));

    let resolved = false;
    const done = runStdio({ engineUrl: "http://127.0.0.1:9" }, { stdin, stdout }).then(() => { resolved = true; });

    stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }) + "\n");
    await new Promise((r) => setTimeout(r, 100));
    expect(resolved).toBe(false);
    expect(out.join("")).toContain("lelu_revoke_token");

    stdin.end();
    await done;
    expect(resolved).toBe(true);
  });

  it("answers a request that was still in flight when stdin closed", async () => {
    const engine = await fakeEngine();
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const out: string[] = [];
    stdout.on("data", (c: Buffer) => out.push(c.toString()));

    // Request and end of input arrive together; the tool call has to reach
    // the engine before the response can be written.
    stdin.end(JSON.stringify({
      jsonrpc: "2.0", id: 7, method: "tools/call",
      params: { name: "lelu_revoke_token", arguments: { token_id: "tok-1" } },
    }) + "\n");
    await runStdio({ engineUrl: engine.url }, { stdin, stdout });

    const response = out.join("").split("\n").filter(Boolean).map((l) => JSON.parse(l)).find((m) => m.id === 7);
    expect(response?.result?.isError).toBeFalsy();
    expect(engine.requests.at(-1)).toEqual({ method: "DELETE", url: "/v1/tokens/tok-1" });
  });

  it("resolves at once when stdin has already ended", async () => {
    const stdin = new PassThrough();
    stdin.end();
    stdin.resume();
    await new Promise((r) => setImmediate(r));
    await runStdio({ engineUrl: "http://127.0.0.1:9" }, { stdin, stdout: new PassThrough() });
  });
});
