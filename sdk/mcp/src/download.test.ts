import { afterEach, describe, expect, it } from "vitest";
import * as http from "node:http";
import type { AddressInfo } from "node:net";
import {
  DownloadHttpError,
  downloadWithResume,
  engineIsHealthy,
  pickEngineRelease,
  type EngineReleaseInfo,
} from "./local-engine.js";

const ASSET = "lelu-engine-linux-amd64";
const SUMS = "SHA256SUMS.txt";
const files = (...names: string[]) => names.map((name) => ({ name }));

describe("pickEngineRelease", () => {
  it("skips a newer release that has no files attached", () => {
    // The engine-v0.3.0 case: release-please made the release, the build never ran.
    const releases: EngineReleaseInfo[] = [
      { tag_name: "engine-v0.3.0", assets: [] },
      { tag_name: "engine-v0.2.1", assets: files(ASSET, SUMS) },
    ];
    expect(pickEngineRelease(releases, ASSET)).toBe("engine-v0.2.1");
  });

  it("picks the newest release when it has the binary and checksums", () => {
    const releases: EngineReleaseInfo[] = [
      { tag_name: "engine-v0.3.0", assets: files(ASSET, SUMS) },
      { tag_name: "engine-v0.2.1", assets: files(ASSET, SUMS) },
    ];
    expect(pickEngineRelease(releases, ASSET)).toBe("engine-v0.3.0");
  });

  it("skips a release missing this platform's binary or the checksums file", () => {
    const releases: EngineReleaseInfo[] = [
      { tag_name: "engine-v0.4.0", assets: files("lelu-engine-darwin-arm64", SUMS) },
      { tag_name: "engine-v0.3.0", assets: files(ASSET) },
      { tag_name: "engine-v0.2.1", assets: files(ASSET, SUMS) },
    ];
    expect(pickEngineRelease(releases, ASSET)).toBe("engine-v0.2.1");
  });

  it("ignores drafts and other components' releases", () => {
    const releases: EngineReleaseInfo[] = [
      { tag_name: "engine-v0.5.0", draft: true, assets: files(ASSET, SUMS) },
      { tag_name: "python-sdk-v0.4.42", assets: files(ASSET, SUMS) },
      { tag_name: "v0.0.14", assets: files(ASSET, SUMS) },
    ];
    expect(pickEngineRelease(releases, ASSET)).toBeNull();
  });
});

// ─── downloadWithResume against a real local HTTP server ─────────────────────

type Handler = (req: http.IncomingMessage, res: http.ServerResponse, requestNo: number) => void;

const servers: http.Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => {
    s.closeAllConnections();
    return new Promise((r) => s.close(r));
  }));
});

async function serve(handler: Handler): Promise<{ url: string; requests: http.IncomingMessage[] }> {
  const requests: http.IncomingMessage[] = [];
  const server = http.createServer((req, res) => {
    requests.push(req);
    handler(req, res, requests.length);
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, requests };
}

const BODY = Buffer.from(Array.from({ length: 64 * 1024 }, (_, i) => i % 251));

/** Serves BODY, honouring "Range: bytes=N-" when `ranges` is true. */
function sendBody(req: http.IncomingMessage, res: http.ServerResponse, ranges = true) {
  const m = req.headers.range?.match(/^bytes=(\d+)-$/);
  if (ranges && m) {
    const start = Number(m[1]);
    res.writeHead(206, {
      "Content-Length": BODY.length - start,
      "Content-Range": `bytes ${start}-${BODY.length - 1}/${BODY.length}`,
    });
    res.end(BODY.subarray(start));
  } else {
    res.writeHead(200, { "Content-Length": BODY.length });
    res.end(BODY);
  }
}

/** Sends the headers and the first half of BODY, then drops the connection. */
function dropHalfway(res: http.ServerResponse) {
  res.writeHead(200, { "Content-Length": BODY.length });
  res.write(BODY.subarray(0, BODY.length / 2), () => res.destroy());
}

const fast = { backoffMs: 0 };

describe("downloadWithResume", () => {
  it("downloads a file in one go", async () => {
    const { url } = await serve((req, res) => sendBody(req, res));
    expect((await downloadWithResume(url, fast)).equals(BODY)).toBe(true);
  });

  it("resumes with a Range request after the connection drops", async () => {
    const { url, requests } = await serve((req, res, n) => (n === 1 ? dropHalfway(res) : sendBody(req, res)));
    const retries: number[] = [];
    const buf = await downloadWithResume(url, { ...fast, onRetry: (a) => retries.push(a) });

    expect(buf.equals(BODY)).toBe(true);
    expect(retries).toEqual([1]);
    expect(requests).toHaveLength(2);
    expect(requests[1]!.headers.range).toBe(`bytes=${BODY.length / 2}-`);
  });

  it("starts over when the server ignores the Range header", async () => {
    const { url } = await serve((req, res, n) => (n === 1 ? dropHalfway(res) : sendBody(req, res, false)));
    expect((await downloadWithResume(url, fast)).equals(BODY)).toBe(true);
  });

  it("retries a connection that stalls instead of waiting forever", async () => {
    const { url } = await serve((req, res, n) => {
      if (n === 1) {
        res.writeHead(200, { "Content-Length": BODY.length });
        res.write(BODY.subarray(0, 1000)); // ...then never sends the rest
      } else {
        sendBody(req, res);
      }
    });
    const errors: unknown[] = [];
    const buf = await downloadWithResume(url, { ...fast, stallMs: 200, onRetry: (_, e) => errors.push(e) });

    expect(buf.equals(BODY)).toBe(true);
    expect(String(errors[0])).toMatch(/no data received/);
  });

  it("retries 5xx responses", async () => {
    const { url, requests } = await serve((req, res, n) => {
      if (n === 1) { res.writeHead(503); res.end(); } else sendBody(req, res);
    });
    expect((await downloadWithResume(url, fast)).equals(BODY)).toBe(true);
    expect(requests).toHaveLength(2);
  });

  it("does not retry a 404", async () => {
    const { url, requests } = await serve((_req, res) => { res.writeHead(404); res.end(); });
    await expect(downloadWithResume(url, fast)).rejects.toBeInstanceOf(DownloadHttpError);
    expect(requests).toHaveLength(1);
  });

  it("gives up after the attempt limit and says how far it got", async () => {
    const { url, requests } = await serve((_req, res) => dropHalfway(res));
    await expect(downloadWithResume(url, { ...fast, attempts: 3 })).rejects.toThrow(/failed after 3 attempts/);
    expect(requests).toHaveLength(3);
  });

  it("reports progress against the full size, including after a resume", async () => {
    const { url } = await serve((req, res, n) => (n === 1 ? dropHalfway(res) : sendBody(req, res)));
    const seen: Array<[number, number | null]> = [];
    await downloadWithResume(url, { ...fast, onProgress: (r, t) => seen.push([r, t]) });

    expect(seen.every(([, total]) => total === BODY.length)).toBe(true);
    expect(seen.at(-1)![0]).toBe(BODY.length);
  });
});

describe("engineIsHealthy", () => {
  it("is true when /healthz answers 200", async () => {
    const { url } = await serve((req, res) => {
      res.writeHead(req.url === "/healthz" ? 200 : 404);
      res.end();
    });
    expect(await engineIsHealthy(url)).toBe(true);
  });

  it("is false when nothing is listening", async () => {
    const { url } = await serve(() => {});
    await new Promise((r) => servers.pop()!.close(r));
    expect(await engineIsHealthy(url, 500)).toBe(false);
  });

  it("is false when /healthz is not ok", async () => {
    const { url } = await serve((_req, res) => { res.writeHead(503); res.end(); });
    expect(await engineIsHealthy(url)).toBe(false);
  });
});
