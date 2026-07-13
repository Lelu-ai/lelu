// Zero-config local engine discovery.
//
// `npx lelu-mcp start` runs a local engine on a random port and records it in
// ~/.lelu/engine.json (next to the per-install ~/.lelu/engine.key secret).
// When the SDK is constructed with no baseUrl and no env override, it reads
// those files so `createClient()` / `lelu()` just work against the engine
// that is already running on this machine — no account, no configuration.

export interface LocalEngineInfo {
  baseUrl?: string;
  apiKey?: string;
}

/**
 * Discovers a locally running Lelu engine started by `lelu-mcp`.
 * Returns {} outside Node, when no engine is recorded, or when the recorded
 * engine process is no longer alive.
 */
export function discoverLocalEngine(): LocalEngineInfo {
  // Node-only: browsers and edge runtimes have no filesystem.
  if (typeof process === "undefined" || !process.versions?.node) return {};

  try {
    // Lazy require keeps node builtins out of browser bundles.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("node:fs") as typeof import("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const os = require("node:os") as typeof import("node:os");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require("node:path") as typeof import("node:path");

    const home = process.env["LELU_HOME"] ?? path.join(os.homedir(), ".lelu");

    const runtime = JSON.parse(
      fs.readFileSync(path.join(home, "engine.json"), "utf8")
    ) as { url?: string; pid?: number };
    if (!runtime.url || !runtime.pid) return {};

    // The runtime file survives hard crashes — trust it only if the engine
    // process is still alive (signal 0 = existence check, sends nothing).
    try {
      process.kill(runtime.pid, 0);
    } catch {
      return {};
    }

    const info: LocalEngineInfo = { baseUrl: runtime.url };
    try {
      const key = fs.readFileSync(path.join(home, "engine.key"), "utf8").trim();
      if (key) info.apiKey = key;
    } catch {
      // engine may run keyless (LELU_DEV_INSECURE)
    }
    return info;
  } catch {
    return {};
  }
}
