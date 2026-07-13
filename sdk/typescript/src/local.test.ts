import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverLocalEngine, LeluClient } from "../src/index.js";

let home: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "lelu-home-"));
  process.env["LELU_HOME"] = home;
  delete process.env["LELU_BASE_URL"];
});

afterEach(() => {
  delete process.env["LELU_HOME"];
  rmSync(home, { recursive: true, force: true });
});

function writeRuntime(info: Record<string, unknown>) {
  writeFileSync(join(home, "engine.json"), JSON.stringify(info));
}

describe("discoverLocalEngine()", () => {
  it("returns url and key for a live engine record", () => {
    // Our own pid is guaranteed alive.
    writeRuntime({ url: "http://127.0.0.1:53421", pid: process.pid });
    writeFileSync(join(home, "engine.key"), "lelu_local_abc123\n");

    const info = discoverLocalEngine();
    expect(info.baseUrl).toBe("http://127.0.0.1:53421");
    expect(info.apiKey).toBe("lelu_local_abc123");
  });

  it("returns url without key when engine.key is missing", () => {
    writeRuntime({ url: "http://127.0.0.1:53421", pid: process.pid });

    const info = discoverLocalEngine();
    expect(info.baseUrl).toBe("http://127.0.0.1:53421");
    expect(info.apiKey).toBeUndefined();
  });

  it("ignores a record whose process is dead", () => {
    // Very large pids are practically never allocated.
    writeRuntime({ url: "http://127.0.0.1:53421", pid: 2 ** 30 });

    expect(discoverLocalEngine()).toEqual({});
  });

  it("returns {} when no engine.json exists", () => {
    expect(discoverLocalEngine()).toEqual({});
  });

  it("returns {} for a corrupt engine.json", () => {
    writeFileSync(join(home, "engine.json"), "not-json{");
    expect(discoverLocalEngine()).toEqual({});
  });
});

describe("LeluClient zero-config resolution", () => {
  it("uses the discovered local engine when nothing is configured", async () => {
    writeRuntime({ url: "http://127.0.0.1:53421", pid: process.pid });
    writeFileSync(join(home, "engine.key"), "lelu_local_abc123\n");

    const client = new LeluClient();
    // Verify via an actual request: URL and Authorization header must come
    // from the discovered engine record.
    const calls: Array<{ url: string; auth: string | undefined }> = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: any, init: any) => {
      calls.push({ url: String(url), auth: init?.headers?.["Authorization"] });
      return { ok: true, status: 200, json: async () => ({ status: "ok" }) };
    }) as typeof fetch;
    try {
      await client.isHealthy();
    } finally {
      globalThis.fetch = realFetch;
    }

    expect(calls[0]?.url).toContain("http://127.0.0.1:53421");
    expect(calls[0]?.auth).toBe("Bearer lelu_local_abc123");
  });

  it("explicit baseUrl wins over discovery and does not borrow the local key", async () => {
    writeRuntime({ url: "http://127.0.0.1:53421", pid: process.pid });
    writeFileSync(join(home, "engine.key"), "lelu_local_abc123\n");

    const client = new LeluClient({ baseUrl: "http://engine.example.com" });
    const calls: Array<{ url: string; auth: string | undefined }> = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: any, init: any) => {
      calls.push({ url: String(url), auth: init?.headers?.["Authorization"] });
      return { ok: true, status: 200, json: async () => ({ status: "ok" }) };
    }) as typeof fetch;
    try {
      await client.isHealthy();
    } finally {
      globalThis.fetch = realFetch;
    }

    expect(calls[0]?.url).toContain("http://engine.example.com");
    expect(calls[0]?.auth).toBeUndefined();
  });
});
