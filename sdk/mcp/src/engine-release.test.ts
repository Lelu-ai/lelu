import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as http from "node:http";
import type { AddressInfo } from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import {
  compareEngineTags,
  describeFetchError,
  downloadEngineRelease,
  engineTagForVersion,
  ensureEngineBinary,
  findLatestEngineRelease,
  nextPageUrl,
  readCachedEngineTag,
  sha256Hex,
  type EngineReleaseSource,
} from "./local-engine.js";

const ASSET = "lelu-engine-linux-amd64";
const SUMS = "SHA256SUMS.txt";
const files = (...names: string[]) => names.map((name) => ({ name }));

// ─── Local HTTP server helpers ────────────────────────────────────────────────

const servers: http.Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => {
    s.closeAllConnections();
    return new Promise((r) => s.close(r));
  }));
});

async function serve(handler: http.RequestListener): Promise<{ url: string; requests: string[] }> {
  const requests: string[] = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url ?? "");
    handler(req, res);
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, requests };
}

/** A URL nothing listens on. */
async function deadUrl(): Promise<string> {
  const { url } = await serve(() => {});
  const s = servers.pop()!;
  await new Promise((r) => s.close(r));
  return url;
}

// ─── Release list lookup ──────────────────────────────────────────────────────

describe("nextPageUrl", () => {
  it("returns the rel=next link and null without one", () => {
    const link =
      '<https://api.github.com/repositories/1/releases?per_page=100&page=2>; rel="next", ' +
      '<https://api.github.com/repositories/1/releases?per_page=100&page=5>; rel="last"';
    expect(nextPageUrl(link)).toBe("https://api.github.com/repositories/1/releases?per_page=100&page=2");
    expect(nextPageUrl('<https://x/releases?page=1>; rel="prev"')).toBeNull();
    expect(nextPageUrl(null)).toBeNull();
  });
});

describe("findLatestEngineRelease", () => {
  it("asks for 100 per page and follows Link pages until it finds an engine release", async () => {
    const other = Array.from({ length: 100 }, (_, i) => ({ tag_name: `python-sdk-v0.4.${i}`, assets: [] }));
    const { url, requests } = await serve((req, res) => {
      const page = new URL(req.url!, "http://x").searchParams.get("page") ?? "1";
      const base = `http://${req.headers.host}/repos/Lelu-ai/lelu/releases?per_page=100`;
      if (page === "1") {
        res.writeHead(200, { "Content-Type": "application/json", Link: `<${base}&page=2>; rel="next"` });
        res.end(JSON.stringify(other));
      } else {
        res.writeHead(200, { "Content-Type": "application/json", Link: `<${base}&page=3>; rel="next"` });
        res.end(JSON.stringify([{ tag_name: "engine-v0.3.1", assets: files(ASSET, SUMS) }]));
      }
    });

    expect(await findLatestEngineRelease(ASSET, { apiBase: url })).toBe("engine-v0.3.1");
    expect(requests).toEqual([
      "/repos/Lelu-ai/lelu/releases?per_page=100",
      "/repos/Lelu-ai/lelu/releases?per_page=100&page=2",
    ]);
  });

  it("stops at the page cap", async () => {
    const { url, requests } = await serve((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json", Link: `<http://${req.headers.host}/next>; rel="next"` });
      res.end(JSON.stringify([{ tag_name: "cli-v1.0.0", assets: [] }]));
    });
    await expect(findLatestEngineRelease(ASSET, { apiBase: url, maxPages: 3 })).rejects.toThrow(/searched 3 pages/);
    expect(requests).toHaveLength(3);
  });

  it("names LELU_ENGINE_VERSION on an HTTP error", async () => {
    const { url } = await serve((_req, res) => { res.writeHead(403); res.end("{}"); });
    await expect(findLatestEngineRelease(ASSET, { apiBase: url })).rejects.toThrow(/HTTP 403.*LELU_ENGINE_VERSION/);
  });

  it("gives the network cause and the same hint when the API can't be reached", async () => {
    const url = await deadUrl();
    const err = await findLatestEngineRelease(ASSET, { apiBase: url }).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    const msg = (err as Error).message;
    expect(msg).toMatch(/^Could not reach 127\.0\.0\.1:\d+ to list Lelu engine releases/);
    expect(msg).toMatch(/fetch failed: .*ECONNREFUSED/);
    expect(msg).toMatch(/LELU_ENGINE_VERSION/);
  });
});

describe("describeFetchError", () => {
  it("includes the cause's code and message", () => {
    const cause = Object.assign(new Error("connect ENETUNREACH 140.82.112.6:443"), { code: "ENETUNREACH" });
    expect(describeFetchError(new TypeError("fetch failed", { cause }))).toBe(
      "fetch failed: connect ENETUNREACH 140.82.112.6:443"
    );
    const dns = Object.assign(new Error("getaddrinfo failed"), { code: "ENOTFOUND" });
    expect(describeFetchError(new TypeError("fetch failed", { cause: dns }))).toBe(
      "fetch failed: ENOTFOUND getaddrinfo failed"
    );
  });

  it("handles an AggregateError cause with an empty message", () => {
    const agg = Object.assign(new AggregateError([new Error("connect ETIMEDOUT 1.2.3.4:443")], ""), { code: "ETIMEDOUT" });
    expect(describeFetchError(new TypeError("fetch failed", { cause: agg }))).toBe(
      "fetch failed: connect ETIMEDOUT 1.2.3.4:443"
    );
    const bare = Object.assign(new AggregateError([], ""), { code: "ETIMEDOUT" });
    expect(describeFetchError(new TypeError("fetch failed", { cause: bare }))).toBe("fetch failed: ETIMEDOUT");
  });

  it("passes plain errors and non-errors through", () => {
    expect(describeFetchError(new Error("boom"))).toBe("boom");
    expect(describeFetchError("x")).toBe("x");
  });
});

// ─── Versions ─────────────────────────────────────────────────────────────────

describe("engineTagForVersion / compareEngineTags", () => {
  it("normalises pinned versions to engine tags", () => {
    expect(engineTagForVersion("0.3.1")).toBe("engine-v0.3.1");
    expect(engineTagForVersion("v0.3.1")).toBe("engine-v0.3.1");
    expect(engineTagForVersion("engine-v0.3.1")).toBe("engine-v0.3.1");
  });

  it("compares numerically, not as strings", () => {
    expect(compareEngineTags("engine-v0.10.0", "engine-v0.9.9")!).toBeGreaterThan(0);
    expect(compareEngineTags("engine-v0.2.1", "engine-v0.3.0")!).toBeLessThan(0);
    expect(compareEngineTags("engine-v0.3.0", "engine-v0.3.0")).toBe(0);
    expect(compareEngineTags("engine-v1.0.0", "engine-v1.0.0-rc.1")!).toBeGreaterThan(0);
    expect(compareEngineTags("engine-vnext", "engine-v1.0.0")).toBeNull();
  });
});

// ─── Cached engine upgrade ────────────────────────────────────────────────────

let dir: string;
let dest: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "lelu-mcp-cache-"));
  dest = path.join(dir, "bin", ASSET);
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

/** Puts a binary in the cache, recording `tag` unless it is null (a legacy cache). */
function seedCache(tag: string | null) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, `binary ${tag ?? "legacy"}`);
  if (tag) fs.writeFileSync(`${dest}.release.json`, JSON.stringify({ tag }));
}

interface FakeSource extends EngineReleaseSource {
  lookups: number;
  downloads: string[];
}

function fakeSource(opts: { latest?: string | Error; failDownload?: boolean } = {}): FakeSource {
  const src: FakeSource = {
    lookups: 0,
    downloads: [],
    async latestTag() {
      src.lookups++;
      if (opts.latest instanceof Error) throw opts.latest;
      return opts.latest ?? "engine-v0.3.1";
    },
    async download(tag, _asset, to) {
      src.downloads.push(tag);
      if (opts.failDownload) throw new Error("download failed: offline");
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.writeFileSync(to, `binary ${tag}`);
      return sha256Hex(Buffer.from(`binary ${tag}`));
    },
  };
  return src;
}

const content = () => fs.readFileSync(dest, "utf8");

describe("ensureEngineBinary", () => {
  const quiet = () => {};

  it("downloads the newest release on first run and records its version", async () => {
    const source = fakeSource();
    expect(await ensureEngineBinary({ dest, asset: ASSET, source, log: quiet })).toBe("engine-v0.3.1");
    expect(source.downloads).toEqual(["engine-v0.3.1"]);
    expect(readCachedEngineTag(dest)).toBe("engine-v0.3.1");
  });

  it("replaces a cached engine that differs from the pinned version, without a release lookup", async () => {
    seedCache("engine-v0.3.0");
    const source = fakeSource();
    expect(await ensureEngineBinary({ dest, asset: ASSET, pinnedVersion: "0.3.1", source, log: quiet })).toBe("engine-v0.3.1");
    expect(source.lookups).toBe(0);
    expect(source.downloads).toEqual(["engine-v0.3.1"]);
    expect(content()).toBe("binary engine-v0.3.1");
    expect(readCachedEngineTag(dest)).toBe("engine-v0.3.1");
  });

  it("uses a cached engine that matches the pin with no network at all", async () => {
    seedCache("engine-v0.3.1");
    const source = fakeSource({ latest: new Error("offline") });
    expect(await ensureEngineBinary({ dest, asset: ASSET, pinnedVersion: "0.3.1", source, log: quiet })).toBe("engine-v0.3.1");
    expect(source.lookups).toBe(0);
    expect(source.downloads).toEqual([]);
  });

  it("upgrades an older cached engine when no version is pinned", async () => {
    seedCache("engine-v0.2.1");
    const logs: string[] = [];
    const source = fakeSource({ latest: "engine-v0.3.0" });
    expect(await ensureEngineBinary({ dest, asset: ASSET, source, log: (m) => logs.push(m) })).toBe("engine-v0.3.0");
    expect(source.downloads).toEqual(["engine-v0.3.0"]);
    expect(logs.join("\n")).toMatch(/Upgrading engine-v0\.2\.1 to engine-v0\.3\.0/);
  });

  it("keeps a cached engine that is already the newest (or newer)", async () => {
    seedCache("engine-v0.3.0");
    const source = fakeSource({ latest: "engine-v0.3.0" });
    expect(await ensureEngineBinary({ dest, asset: ASSET, source, log: quiet })).toBe("engine-v0.3.0");
    seedCache("engine-v0.4.0");
    expect(await ensureEngineBinary({ dest, asset: ASSET, source, log: quiet })).toBe("engine-v0.4.0");
    expect(source.downloads).toEqual([]);
  });

  it("treats a legacy cache with no recorded version as needing an upgrade", async () => {
    seedCache(null);
    const source = fakeSource({ latest: "engine-v0.3.1" });
    expect(await ensureEngineBinary({ dest, asset: ASSET, source, log: quiet })).toBe("engine-v0.3.1");
    expect(source.downloads).toEqual(["engine-v0.3.1"]);
    expect(readCachedEngineTag(dest)).toBe("engine-v0.3.1");
  });

  it("keeps working offline with the cached engine when the release list can't be reached", async () => {
    seedCache("engine-v0.3.0");
    const logs: string[] = [];
    const source = fakeSource({ latest: new Error("Could not reach api.github.com (fetch failed)") });
    expect(await ensureEngineBinary({ dest, asset: ASSET, source, log: (m) => logs.push(m) })).toBe("engine-v0.3.0");
    expect(logs.join("\n")).toMatch(/Could not check for a newer engine.*fetch failed/);
    expect(logs.join("\n")).toMatch(/Continuing offline with engine-v0\.3\.0/);
    expect(content()).toBe("binary engine-v0.3.0");
  });

  it("fails on first run when the release list can't be reached", async () => {
    const source = fakeSource({ latest: new Error("Could not reach api.github.com") });
    await expect(ensureEngineBinary({ dest, asset: ASSET, source, log: quiet })).rejects.toThrow(/Could not reach/);
  });

  it("keeps the cached engine when downloading the newer one fails", async () => {
    seedCache("engine-v0.2.1");
    const source = fakeSource({ latest: "engine-v0.3.0", failDownload: true });
    expect(await ensureEngineBinary({ dest, asset: ASSET, source, log: quiet })).toBe("engine-v0.2.1");
    expect(readCachedEngineTag(dest)).toBe("engine-v0.2.1");
    expect(content()).toBe("binary engine-v0.2.1");
  });

  it("refuses to run a different cached version than the pin when the pin can't be downloaded", async () => {
    seedCache("engine-v0.3.0");
    const source = fakeSource({ failDownload: true });
    await expect(ensureEngineBinary({ dest, asset: ASSET, pinnedVersion: "0.3.1", source, log: quiet }))
      .rejects.toThrow(/LELU_ENGINE_VERSION asks for.*cached engine is engine-v0\.3\.0/);
  });

  it("falls back to a legacy cache when the pin can't be downloaded", async () => {
    seedCache(null);
    const source = fakeSource({ failDownload: true });
    expect(await ensureEngineBinary({ dest, asset: ASSET, pinnedVersion: "0.3.1", source, log: quiet })).toBeNull();
    expect(content()).toBe("binary legacy");
  });
});

// ─── Verified download ────────────────────────────────────────────────────────

describe("downloadEngineRelease", () => {
  const BIN = Buffer.from("engine binary bytes");

  async function releaseServer(sums: string) {
    return serve((req, res) => {
      if (req.url === `/engine-v0.3.1/${SUMS}`) { res.writeHead(200); res.end(sums); return; }
      if (req.url === `/engine-v0.3.1/${ASSET}`) { res.writeHead(200, { "Content-Length": BIN.length }); res.end(BIN); return; }
      res.writeHead(404); res.end();
    });
  }

  it("writes the binary only after its checksum matches", async () => {
    const { url } = await releaseServer(`${sha256Hex(BIN)}  ${ASSET}\n`);
    const sha = await downloadEngineRelease("engine-v0.3.1", ASSET, dest, { downloadBase: url, backoffMs: 0 });
    expect(sha).toBe(sha256Hex(BIN));
    expect(fs.readFileSync(dest).equals(BIN)).toBe(true);
  });

  it("refuses a checksum mismatch and leaves the cached binary alone", async () => {
    seedCache("engine-v0.3.0");
    const { url } = await releaseServer(`${"0".repeat(64)}  ${ASSET}\n`);
    await expect(downloadEngineRelease("engine-v0.3.1", ASSET, dest, { downloadBase: url, backoffMs: 0 }))
      .rejects.toThrow(/Checksum mismatch/);
    expect(content()).toBe("binary engine-v0.3.0");
  });

  it("refuses a release whose checksums file does not list the asset", async () => {
    const { url } = await releaseServer(`${sha256Hex(BIN)}  some-other-file\n`);
    await expect(downloadEngineRelease("engine-v0.3.1", ASSET, dest, { downloadBase: url, backoffMs: 0 }))
      .rejects.toThrow(/No checksum entry/);
    expect(fs.existsSync(dest)).toBe(false);
  });
});
