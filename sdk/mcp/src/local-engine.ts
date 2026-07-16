/**
 * local-engine.ts — zero-config local Lelu engine for `npx lelu-mcp`.
 *
 * When no engine URL is configured, lelu-mcp downloads the static engine
 * binary for this platform from GitHub Releases (cached in ~/.lelu/bin),
 * verifies it against the release's published SHA256SUMS.txt before writing
 * it to disk, writes a starter policy to ~/.lelu/policy.yaml on first run,
 * spawns the engine as a child process on a free localhost port, and waits
 * for /healthz.
 *
 * Everything runs on the user's machine — no account, no cloud calls beyond
 * the one-time binary download (plus a GitHub API call to resolve the latest
 * engine release, skipped when LELU_ENGINE_VERSION pins a version).
 *
 * Environment overrides:
 *   LELU_HOME            data dir (default ~/.lelu)
 *   LELU_ENGINE_BINARY   path to a locally built engine (skips download)
 *   LELU_ENGINE_VERSION  pin a release version, e.g. "0.1.0" (default: latest)
 *   LELU_POLICY_PATH     policy file to load (default ~/.lelu/policy.yaml)
 */

import { spawn, type ChildProcess } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";

const REPO = "Lelu-ai/lelu";

export interface LocalEngine {
  /** Base URL of the running local engine, e.g. http://127.0.0.1:53421 */
  url: string;
  /** API key the local engine was started with — pass as Bearer token. */
  apiKey: string;
  /** Terminates the engine child process. */
  stop: () => void;
}

// The engine requires an API key even locally. Generate one per install and
// persist it in ~/.lelu so the key is stable across restarts (0600, local only).
async function ensureLocalApiKey(): Promise<string> {
  const keyPath = path.join(leluHome(), "engine.key");
  try {
    const existing = (await fsp.readFile(keyPath, "utf8")).trim();
    if (existing) return existing;
  } catch {
    // first run
  }
  const key = `lelu_local_${randomBytes(24).toString("base64url")}`;
  await fsp.mkdir(path.dirname(keyPath), { recursive: true });
  await fsp.writeFile(keyPath, `${key}\n`, { mode: 0o600 });
  return key;
}

// Starter policy written to ~/.lelu/policy.yaml on first run. Uses top-level
// pattern rules (actor-independent) so it works with any agent name, and ends
// default-deny so unlisted actions are blocked rather than silently allowed.
const DEFAULT_POLICY = `version: "1.0"

# ─────────────────────────────────────────────────────────────────────────────
# Lelu starter policy — created by lelu-mcp on first run.
#
# Edit this file, then restart lelu-mcp to apply changes.
# Rules are evaluated top to bottom; the first match on the action wins.
# Globs: "read_*" (prefix), "*_prod" (suffix), "*delete*" (contains), "*" (all)
# Decisions: allow | deny | human_review | compute
# ─────────────────────────────────────────────────────────────────────────────

rules:
  # ── Destructive operations are always denied ──────────────────────────────
  - id: deny-delete
    match: "*delete*"
    decision: deny
    reason: "Destructive operations are blocked by the starter policy."
  - id: deny-drop
    match: "*drop*"
    decision: deny
    reason: "Destructive operations are blocked by the starter policy."
  - id: deny-wipe
    match: "*wipe*"
    decision: deny
    reason: "Destructive operations are blocked by the starter policy."

  # ── Shell / code execution is denied by default ───────────────────────────
  - id: deny-exec
    match: "*exec*"
    decision: deny
    reason: "Code execution requires an explicit allow rule."
  - id: deny-shell
    match: "*shell*"
    decision: deny
    reason: "Shell access requires an explicit allow rule."

  # ── Money and outbound communication need a human ─────────────────────────
  - id: review-payments
    match: "*payment*"
    decision: human_review
    reason: "Financial operations require human approval."
  - id: review-transfers
    match: "*transfer*"
    decision: human_review
    reason: "Financial operations require human approval."
  - id: review-email
    match: "send_*"
    decision: human_review
    reason: "Outbound communication requires human sign-off."

  # ── Risky writes are redirected to a sandbox instead of blocked ───────────
  - id: compute-prod-writes
    match: "write_*_prod"
    decision: compute
    safe_tool: write_file
    safe_args:
      path: "/tmp/lelu-sandbox/{original}"
      sandboxed: true
    reason: "Production writes are redirected to a sandbox path."

  # ── Read-only and low-risk operations are allowed ─────────────────────────
  - id: allow-read
    match: "read_*"
    decision: allow
  - id: allow-get
    match: "get_*"
    decision: allow
  - id: allow-list
    match: "list_*"
    decision: allow
  - id: allow-search
    match: "search_*"
    decision: allow
  - id: allow-view
    match: "view_*"
    decision: allow
  - id: allow-create
    match: "create_*"
    decision: allow

  # ── Everything else: default deny ──────────────────────────────────────────
  - id: default-deny
    match: "*"
    decision: deny
    reason: "Default-deny: no rule allows this action. Add one to ~/.lelu/policy.yaml and restart."
`;

function leluHome(): string {
  return process.env["LELU_HOME"] ?? path.join(os.homedir(), ".lelu");
}

function assetName(): string {
  const osName =
    process.platform === "linux" ? "linux"
    : process.platform === "darwin" ? "darwin"
    : process.platform === "win32" ? "windows"
    : undefined;
  const arch =
    process.arch === "x64" ? "amd64"
    : process.arch === "arm64" ? "arm64"
    : undefined;
  if (!osName || !arch) {
    throw new Error(
      `No prebuilt Lelu engine for ${process.platform}/${process.arch}. ` +
      `Build from source (go build ./cmd/engine in engine/) and set LELU_ENGINE_BINARY, ` +
      `or point LELU_ENGINE_URL at a running engine.`
    );
  }
  return `lelu-engine-${osName}-${arch}${osName === "windows" ? ".exe" : ""}`;
}

const ENGINE_RELEASE_TAG_PREFIX = "engine-v";

// Resolves the release tag to download from. Pinned versions go straight to
// their tag (no network call). Unpinned installs must NOT use GitHub's
// generic `releases/latest` — a second, separate workflow (oss-release.yml)
// also publishes `lelu-engine-*` binaries under a `v*` tag but without a
// checksums file, and "latest" can resolve to either. Querying the release
// list and filtering by prefix guarantees we always land on a release that
// has a matching SHA256SUMS.txt.
async function resolveEngineReleaseTag(): Promise<string> {
  const pinned = process.env["LELU_ENGINE_VERSION"];
  if (pinned) return `${ENGINE_RELEASE_TAG_PREFIX}${pinned}`;

  const res = await fetch(`https://api.github.com/repos/${REPO}/releases`, {
    headers: { "User-Agent": "lelu-mcp", Accept: "application/vnd.github+json" },
  });
  if (!res.ok) {
    throw new Error(
      `Could not list Lelu engine releases (HTTP ${res.status}). ` +
      `Set LELU_ENGINE_VERSION to pin a version, LELU_ENGINE_BINARY to a locally built engine, or LELU_ENGINE_URL to a running one.`
    );
  }
  const releases = (await res.json()) as Array<{ tag_name?: string }>;
  const engineRelease = releases.find((r) => r.tag_name?.startsWith(ENGINE_RELEASE_TAG_PREFIX));
  if (!engineRelease?.tag_name) {
    throw new Error(
      `No "${ENGINE_RELEASE_TAG_PREFIX}*" release found for ${REPO}. ` +
      `Set LELU_ENGINE_VERSION to pin a version, LELU_ENGINE_BINARY to a locally built engine, or LELU_ENGINE_URL to a running one.`
    );
  }
  return engineRelease.tag_name;
}

// Parses `sha256sum`-style checksum output ("<hex digest>  <filename>" per
// line, optionally with a "*" binary-mode marker before the filename) and
// returns the expected digest for `filename`, or null if it isn't listed.
export function findChecksum(checksumsText: string, filename: string): string | null {
  for (const line of checksumsText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/);
    if (!match) continue;
    const [, hash, name] = match;
    if (name === filename) return hash.toLowerCase();
  }
  return null;
}

export function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function downloadEngine(dest: string): Promise<void> {
  const asset = assetName();
  const tag = await resolveEngineReleaseTag();
  const baseUrl = `https://github.com/${REPO}/releases/download/${tag}`;

  console.error(`[lelu-mcp] First run: downloading Lelu engine → ${baseUrl}/${asset}`);

  // Fetch and verify the checksum BEFORE writing anything to disk — refuse to
  // install an engine binary whose integrity can't be confirmed.
  const checksumsUrl = `${baseUrl}/SHA256SUMS.txt`;
  const checksumsRes = await fetch(checksumsUrl);
  if (!checksumsRes.ok) {
    throw new Error(
      `Could not download checksums (HTTP ${checksumsRes.status}) from ${checksumsUrl} — ` +
      `refusing to install an unverified engine binary. Set LELU_ENGINE_BINARY to a locally built engine instead.`
    );
  }
  const expected = findChecksum(await checksumsRes.text(), asset);
  if (!expected) {
    throw new Error(
      `No checksum entry for "${asset}" in ${checksumsUrl} — refusing to install an unverified engine binary.`
    );
  }

  const res = await fetch(`${baseUrl}/${asset}`);
  if (!res.ok) {
    throw new Error(
      `Engine download failed (HTTP ${res.status}) from ${baseUrl}/${asset}. ` +
      `Set LELU_ENGINE_BINARY to a locally built engine, or LELU_ENGINE_URL to a running one.`
    );
  }
  const buf = Buffer.from(await res.arrayBuffer());

  const actual = sha256Hex(buf);
  if (actual !== expected) {
    throw new Error(
      `Checksum mismatch for ${asset}: expected ${expected}, got ${actual}. ` +
      `The download may be corrupted or tampered with — refusing to install it.`
    );
  }

  await fsp.mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.download-${process.pid}`;
  await fsp.writeFile(tmp, buf, { mode: 0o755 });
  await fsp.rename(tmp, dest);
  console.error(`[lelu-mcp] Engine cached at ${dest} (checksum verified)`);
}

async function resolveBinary(): Promise<string> {
  const explicit = process.env["LELU_ENGINE_BINARY"];
  if (explicit) {
    if (!fs.existsSync(explicit)) {
      throw new Error(`LELU_ENGINE_BINARY points to a missing file: ${explicit}`);
    }
    return explicit;
  }
  const cached = path.join(leluHome(), "bin", assetName());
  if (!fs.existsSync(cached)) await downloadEngine(cached);
  return cached;
}

async function ensurePolicy(): Promise<string> {
  const policyPath = process.env["LELU_POLICY_PATH"] ?? path.join(leluHome(), "policy.yaml");
  if (!fs.existsSync(policyPath)) {
    await fsp.mkdir(path.dirname(policyPath), { recursive: true });
    await fsp.writeFile(policyPath, DEFAULT_POLICY, "utf8");
    console.error(`[lelu-mcp] Starter policy written to ${policyPath} — edit it to change the rules`);
  }
  return policyPath;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      if (address && typeof address === "object") {
        const { port } = address;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error("could not allocate a local port")));
      }
    });
  });
}

async function waitHealthy(url: string, child: ChildProcess, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let exited = false;
  child.once("exit", () => { exited = true; });
  while (Date.now() < deadline) {
    if (exited) throw new Error("Lelu engine exited during startup — see log lines above.");
    try {
      const res = await fetch(`${url}/healthz`, { signal: AbortSignal.timeout(1_000) });
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Lelu engine did not become healthy within ${timeoutMs / 1000}s`);
}

/**
 * Downloads (if needed) and starts a local Lelu engine, returning its URL.
 * The child is killed when the MCP process exits.
 */
export async function startLocalEngine(): Promise<LocalEngine> {
  const [bin, policyPath, apiKey] = await Promise.all([
    resolveBinary(),
    ensurePolicy(),
    ensureLocalApiKey(),
  ]);
  const home = leluHome();
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;

  const child = spawn(bin, [], {
    env: {
      // Dev-mode confidence defaults: MCP hosts cannot produce verified
      // provider signals (logprobs/entropy), so accept self-reported
      // confidence and route signal-less requests to human review instead of
      // hard-denying. Listed before the spread so your env vars override them.
      CONFIDENCE_ALLOW_UNVERIFIED: "true",
      CONFIDENCE_MISSING_MODE: "review",
      ...process.env,
      LISTEN_ADDR: `127.0.0.1:${port}`,
      POLICY_PATH: policyPath,
      API_KEY: apiKey,
      DATABASE_PATH: path.join(home, "lelu.db"),
      LELU_RSA_KEY_PATH: path.join(home, "signing.key.pem"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Engine logs go to stderr so they never pollute the MCP stdio stream.
  const forward = (chunk: Buffer) => {
    for (const line of chunk.toString().split("\n")) {
      if (line.trim()) console.error(`[engine] ${line}`);
    }
  };
  child.stdout?.on("data", forward);
  child.stderr?.on("data", forward);

  // Advertise the running engine so other local tools (the lelu-agent-auth
  // SDK) can discover its URL — the port is random per start. Removed on stop;
  // readers must also check the pid is still alive to survive hard crashes.
  const runtimePath = path.join(home, "engine.json");
  const writeRuntimeFile = async () => {
    const info = { url, pid: child.pid, startedAt: new Date().toISOString() };
    await fsp.writeFile(runtimePath, `${JSON.stringify(info)}\n`, { mode: 0o600 });
  };
  const removeRuntimeFile = () => {
    try {
      const current = JSON.parse(fs.readFileSync(runtimePath, "utf8")) as { pid?: number };
      // Only remove our own record — a newer lelu-mcp may have replaced it.
      if (current.pid === child.pid) fs.unlinkSync(runtimePath);
    } catch { /* already gone or unreadable */ }
  };

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    removeRuntimeFile();
    try { child.kill("SIGTERM"); } catch { /* already gone */ }
  };
  process.on("exit", stop);
  process.on("SIGINT", () => { stop(); process.exit(130); });
  process.on("SIGTERM", () => { stop(); process.exit(143); });

  try {
    await waitHealthy(url, child);
    await writeRuntimeFile();
  } catch (err) {
    stop();
    throw err;
  }

  console.error(`[lelu-mcp] Local Lelu engine ready on ${url} (policy: ${policyPath})`);
  return { url, apiKey, stop };
}
