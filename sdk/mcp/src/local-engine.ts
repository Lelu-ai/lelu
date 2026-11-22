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
 *   LELU_POLICY_PATH     policy file to load (default ~/.lelu/policy.yaml, or
 *                        ~/.lelu/policy.<preset>.yaml for a non-general preset)
 *   LELU_POLICY_PRESET   starter policy preset: general | coding-agent
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

// ─── Starter policies ─────────────────────────────────────────────────────────
//
// Written on first run. Uses top-level pattern rules (actor-independent) so
// they work with any agent name, and end default-deny so unlisted actions are
// blocked rather than silently allowed.
//
// Rules match the action *name* the caller chooses, first match wins, so the
// order below is the security property: deny and review rules for
// destructive, execution and secret-touching names come before any allow
// prefix. Otherwise "read_secrets" is allowed by "read_*" and
// "search_and_destroy" by "search_*", and synonyms ("rm_file", "run_sql")
// only stay blocked by default-deny until someone adds an allow rule.

export type PolicyPreset = "general" | "coding-agent";

export const POLICY_PRESETS: readonly PolicyPreset[] = ["general", "coding-agent"];

const POLICY_HEADER = (preset: PolicyPreset) => `version: "1.0"

# ─────────────────────────────────────────────────────────────────────────────
# Lelu starter policy (preset: ${preset}) — created by lelu-mcp on first run.
#
# Edit this file, then restart lelu-mcp to apply changes.
# Rules are evaluated top to bottom; the first match on the action wins, so
# keep deny/review rules above allow rules. Matching is on the action name the
# agent supplies — list the synonyms you care about.
# Globs: "read_*" (prefix), "*_prod" (suffix), "*delete*" (contains), "*" (all)
# Decisions: allow | deny | human_review | compute
#
# Omitting the confidence value never loosens a deny: an action this policy
# denies stays denied. Other actions without confidence go to human review.
# ─────────────────────────────────────────────────────────────────────────────

rules:
`;

function rule(id: string, match: string, decision: string, reason?: string): string {
  return `  - id: ${id}
    match: "${match}"
    decision: ${decision}
` + (reason ? `    reason: "${reason}"
` : "");
}

const DESTRUCTIVE = "Destructive operations are blocked by the starter policy.";
const DESTRUCTIVE_RULES =
  `  # ── Destructive operations are always denied (synonyms included) ────────\n` +
  [
    ["deny-delete", "*delete*"], ["deny-drop", "*drop*"], ["deny-wipe", "*wipe*"],
    ["deny-destroy", "*destroy*"], ["deny-truncate", "*truncate*"], ["deny-purge", "*purge*"],
    ["deny-erase", "*erase*"], ["deny-remove", "remove_*"], ["deny-rm", "rm_*"],
    ["deny-unlink", "unlink_*"],
  ].map(([id, m]) => rule(id!, m!, "deny", DESTRUCTIVE)).join("");

const EXEC = "Code execution requires an explicit allow rule.";
const EXEC_RULES =
  `\n  # ── Shell / code / SQL execution is denied by default ───────────────────\n` +
  [
    ["deny-exec", "*exec*"], ["deny-shell", "*shell*"], ["deny-bash", "bash*"],
    ["deny-command", "*command*"], ["deny-eval", "eval*"], ["deny-sql", "*sql*"],
  ].map(([id, m]) => rule(id!, m!, "deny", EXEC)).join("");

const SECRETS = "Actions that touch secrets, credentials or env files need human sign-off.";
const SECRET_RULES =
  `\n  # ── Secrets: checked before the allow prefixes, so "read_secrets" and ───\n` +
  `  #    "get_aws_credentials" are not allowed by "read_*" / "get_*" ──────────\n` +
  [
    ["review-secret", "*secret*"], ["review-credential", "*credential*"],
    ["review-password", "*password*"], ["review-env-file", "*env_file*"],
    ["review-dotenv", "*dotenv*"], ["review-private-key", "*private_key*"],
    ["review-api-key", "*api_key*"], ["review-ssh-key", "*ssh_key*"],
  ].map(([id, m]) => rule(id!, m!, "human_review", SECRETS)).join("");

const OUTBOUND_RULES = `
  # ── Money and outbound communication need a human ─────────────────────────
` + rule("review-payments", "*payment*", "human_review", "Financial operations require human approval.")
  + rule("review-transfers", "*transfer*", "human_review", "Financial operations require human approval.")
  + rule("review-email", "send_*", "human_review", "Outbound communication requires human sign-off.");

const COMPUTE_RULES = `
  # ── Risky writes are redirected to a sandbox instead of blocked ───────────
  - id: compute-prod-writes
    match: "write_*_prod"
    decision: compute
    safe_tool: write_file
    safe_args:
      path: "/tmp/lelu-sandbox/{original}"
      sandboxed: true
    reason: "Production writes are redirected to a sandbox path."
`;

const READ_ALLOW_RULES = `
  # ── Read-only and low-risk operations are allowed ─────────────────────────
` + [
  ["allow-read", "read_*"], ["allow-get", "get_*"], ["allow-list", "list_*"],
  ["allow-search", "search_*"], ["allow-view", "view_*"], ["allow-create", "create_*"],
].map(([id, m]) => rule(id!, m!, "allow")).join("");

const DEFAULT_DENY = (file: string) => `
  # ── Everything else: default deny ──────────────────────────────────────────
` + rule("default-deny", "*", "deny", `Default-deny: no rule allows this action. Add one to ${file} and restart.`);

// The coding-agent preset is for Claude Code and similar: the everyday loop
// (edit, test, build, local git) is allowed, anything that leaves the
// machine or changes dependencies goes to a human, and the destructive,
// execution and secret rules above still apply first.
const CODING_REVIEW_RULES = `
  # ── Leaves the machine or changes dependencies: a human decides ───────────
` + rule("deny-force", "*force*", "deny", "Force operations rewrite shared history and are blocked by the starter policy.")
  + [
    ["review-install", "*install*", "Package installs run third-party code; a human approves them."],
    ["review-push", "*push*", "Pushing changes leaves this machine; a human approves it."],
    ["review-merge", "*merge*", "Merges change shared branches; a human approves them."],
    ["review-deploy", "*deploy*", "Deploys need human sign-off."],
    ["review-publish", "*publish*", "Publishing needs human sign-off."],
    ["review-release", "*release*", "Releases need human sign-off."],
  ].map(([id, m, r]) => rule(id!, m!, "human_review", r)).join("");

const CODING_ALLOW_RULES = `
  # ── The everyday coding loop is allowed ───────────────────────────────────
` + [
  ["allow-edit", "edit_*"], ["allow-write", "write_*"], ["allow-run-tests", "run_*test*"],
  ["allow-test", "test_*"], ["allow-tests-suffix", "*_test"], ["allow-tests-suffix2", "*_tests"],
  ["allow-lint", "lint*"], ["allow-format", "format*"], ["allow-build", "build*"],
  ["allow-run-build", "run_build*"], ["allow-typecheck", "typecheck*"],
  ["allow-git-status", "git_status"], ["allow-git-diff", "git_diff"], ["allow-git-log", "git_log"],
  ["allow-git-add", "git_add"], ["allow-git-commit", "git_commit"], ["allow-git-branch", "git_branch"],
  ["allow-git-checkout", "git_checkout"],
].map(([id, m]) => rule(id!, m!, "allow")).join("");

/** Returns the starter policy YAML for a preset. `file` is named in the default-deny reason. */
export function starterPolicy(preset: PolicyPreset, file: string): string {
  const head = POLICY_HEADER(preset) + DESTRUCTIVE_RULES + EXEC_RULES + SECRET_RULES + OUTBOUND_RULES;
  if (preset === "coding-agent") {
    return head + CODING_REVIEW_RULES + COMPUTE_RULES + CODING_ALLOW_RULES + READ_ALLOW_RULES + DEFAULT_DENY(file);
  }
  return head + COMPUTE_RULES + READ_ALLOW_RULES + DEFAULT_DENY(file);
}

/** Resolves the preset from an explicit value or LELU_POLICY_PRESET (default: general). */
export function resolvePreset(explicit?: string): PolicyPreset {
  const raw = (explicit ?? process.env["LELU_POLICY_PRESET"] ?? "general").trim();
  if ((POLICY_PRESETS as readonly string[]).includes(raw)) return raw as PolicyPreset;
  throw new Error(`Unknown policy preset "${raw}". Use one of: ${POLICY_PRESETS.join(", ")}.`);
}

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
const CHECKSUMS_FILE = "SHA256SUMS.txt";

/** The fields of a GitHub release (from the list-releases API) this module reads. */
export interface EngineReleaseInfo {
  tag_name?: string;
  draft?: boolean;
  assets?: Array<{ name?: string }>;
}

/**
 * Returns the tag of the newest engine release that actually ships `asset`
 * and a checksums file, or null if none does. `releases` is newest first, as
 * GitHub's list-releases API returns it.
 *
 * A release can exist without its files: release-please creates the release,
 * and the binaries are attached by a separate workflow that may not have run
 * yet (or failed). Picking such a release breaks every fresh install, so it
 * is skipped rather than trusted.
 */
export function pickEngineRelease(releases: EngineReleaseInfo[], asset: string): string | null {
  for (const release of releases) {
    if (release.draft || !release.tag_name?.startsWith(ENGINE_RELEASE_TAG_PREFIX)) continue;
    const names = new Set((release.assets ?? []).map((a) => a.name));
    if (names.has(asset) && names.has(CHECKSUMS_FILE)) return release.tag_name;
  }
  return null;
}

// Resolves the release tag to download from. Pinned versions go straight to
// their tag (no network call). Unpinned installs must NOT use GitHub's
// generic `releases/latest` — a second, separate workflow (oss-release.yml)
// also publishes `lelu-engine-*` binaries under a `v*` tag but without a
// checksums file, and "latest" can resolve to either. Querying the release
// list and filtering by prefix and attached files guarantees we always land
// on a release that has this platform's binary and a matching SHA256SUMS.txt.
async function resolveEngineReleaseTag(asset: string): Promise<string> {
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
  const releases = (await res.json()) as EngineReleaseInfo[];
  const tag = pickEngineRelease(releases, asset);
  if (!tag) {
    throw new Error(
      `No "${ENGINE_RELEASE_TAG_PREFIX}*" release of ${REPO} has both ${asset} and ${CHECKSUMS_FILE} attached. ` +
      `Set LELU_ENGINE_VERSION to pin a version, LELU_ENGINE_BINARY to a locally built engine, or LELU_ENGINE_URL to a running one.`
    );
  }
  const newest = releases.find((r) => !r.draft && r.tag_name?.startsWith(ENGINE_RELEASE_TAG_PREFIX))?.tag_name;
  if (newest && newest !== tag) {
    console.error(`[lelu-mcp] ${newest} has no ${asset} attached yet; using ${tag} instead.`);
  }
  return tag;
}

// ─── Resumable download ───────────────────────────────────────────────────────

/** An HTTP status that retrying will not fix (404, 403, ...). */
export class DownloadHttpError extends Error {
  constructor(readonly status: number, url: string) {
    super(`HTTP ${status} from ${url}`);
    this.name = "DownloadHttpError";
  }
}

export interface DownloadOptions {
  /** Total tries, including the first. Default 8. */
  attempts?: number;
  /** Abort a try when no bytes arrive for this long. Default 30s. */
  stallMs?: number;
  /**
   * Delay before the first retry; doubles each retry, capped at 30s. Default 1s.
   * With the default 8 tries that waits about 1.5 minutes in total, enough to
   * ride out a short network outage instead of giving up after seconds.
   */
  backoffMs?: number;
  /** Called as bytes arrive. `total` is null when the server doesn't say. */
  onProgress?: (received: number, total: number | null) => void;
  /** Called before each retry. */
  onRetry?: (attempt: number, error: unknown) => void;
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 429;
}

/**
 * Downloads `url` into memory. A dropped or stalled connection is retried,
 * resuming from the bytes already received with an HTTP Range request (and
 * starting over if the server ignores the range). There is no limit on total
 * time, only on silence, so slow connections still finish.
 */
export async function downloadWithResume(url: string, opts: DownloadOptions = {}): Promise<Buffer> {
  const attempts = opts.attempts ?? 8;
  const stallMs = opts.stallMs ?? 30_000;
  const backoffMs = opts.backoffMs ?? 1_000;

  let chunks: Buffer[] = [];
  let received = 0;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    const armStallTimer = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(
        () => controller.abort(new Error(`no data received for ${stallMs / 1000}s`)),
        stallMs,
      );
    };

    try {
      armStallTimer();
      const headers: Record<string, string> = { "User-Agent": "lelu-mcp" };
      if (received > 0) headers["Range"] = `bytes=${received}-`;
      const res = await fetch(url, { headers, signal: controller.signal });

      let total: number | null;
      if (res.status === 206) {
        // Resumed: "Content-Range: bytes 1000-2999/3000" carries the full size.
        const m = res.headers.get("content-range")?.match(/\/(\d+)$/);
        total = m ? Number(m[1]) : null;
      } else if (res.ok) {
        // A full response. If we asked for a range, the server ignored it.
        chunks = [];
        received = 0;
        const len = res.headers.get("content-length");
        total = len ? Number(len) : null;
      } else if (res.status === 416) {
        // Our range no longer fits the file (it changed upstream): start over.
        chunks = [];
        received = 0;
        throw new Error("server rejected the resume range");
      } else if (isRetryableStatus(res.status)) {
        throw new Error(`HTTP ${res.status}`);
      } else {
        throw new DownloadHttpError(res.status, url);
      }

      if (!res.body) throw new Error("response has no body");
      for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
        armStallTimer();
        const buf = Buffer.from(chunk);
        chunks.push(buf);
        received += buf.length;
        opts.onProgress?.(received, total);
      }
      if (total !== null && received !== total) {
        throw new Error(`connection closed after ${received} of ${total} bytes`);
      }
      return Buffer.concat(chunks, received);
    } catch (err) {
      if (err instanceof DownloadHttpError) throw err;
      lastError = controller.signal.aborted ? controller.signal.reason : err;
      if (attempt < attempts) {
        opts.onRetry?.(attempt, lastError);
        await new Promise((r) => setTimeout(r, Math.min(backoffMs * 2 ** (attempt - 1), 30_000)));
      }
    } finally {
      clearTimeout(stallTimer);
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`download of ${url} failed after ${attempts} attempts (${received} bytes received): ${reason}`);
}

/** True when an engine answers GET /healthz at `url` within `timeoutMs`. */
export async function engineIsHealthy(url: string, timeoutMs = 2_000): Promise<boolean> {
  try {
    const res = await fetch(`${url}/healthz`, { signal: AbortSignal.timeout(timeoutMs) });
    return res.ok;
  } catch {
    return false;
  }
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
  const tag = await resolveEngineReleaseTag(asset);
  const baseUrl = `https://github.com/${REPO}/releases/download/${tag}`;

  console.error(`[lelu-mcp] First run: downloading Lelu engine → ${baseUrl}/${asset}`);

  const onRetry = (attempt: number, err: unknown) =>
    console.error(`[lelu-mcp] Download interrupted (${err instanceof Error ? err.message : err}); retry ${attempt}…`);

  // Fetch and verify the checksum BEFORE writing anything to disk — refuse to
  // install an engine binary whose integrity can't be confirmed.
  const checksumsUrl = `${baseUrl}/${CHECKSUMS_FILE}`;
  let checksumsText: string;
  try {
    checksumsText = (await downloadWithResume(checksumsUrl, { onRetry })).toString("utf8");
  } catch (err) {
    throw new Error(
      `Could not download checksums (${err instanceof Error ? err.message : err}) — ` +
      `refusing to install an unverified engine binary. Set LELU_ENGINE_BINARY to a locally built engine instead.`
    );
  }
  const expected = findChecksum(checksumsText, asset);
  if (!expected) {
    throw new Error(
      `No checksum entry for "${asset}" in ${checksumsUrl} — refusing to install an unverified engine binary.`
    );
  }

  // Progress in 10% steps, so a slow first download doesn't look hung.
  let lastStep = 0;
  const onProgress = (received: number, total: number | null) => {
    if (!total) return;
    const step = Math.floor((received / total) * 10);
    if (step > lastStep) {
      lastStep = step;
      const mb = (n: number) => (n / 1_048_576).toFixed(1);
      console.error(`[lelu-mcp] Downloading engine… ${step * 10}% (${mb(received)}/${mb(total)} MB)`);
    }
  };

  let buf: Buffer;
  try {
    buf = await downloadWithResume(`${baseUrl}/${asset}`, { onProgress, onRetry });
  } catch (err) {
    throw new Error(
      `Engine download failed: ${err instanceof Error ? err.message : err}. ` +
      `Set LELU_ENGINE_BINARY to a locally built engine, or LELU_ENGINE_URL to a running one.`
    );
  }

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

// Each preset gets its own default file, so switching presets never silently
// keeps running the previous preset's rules.
export function defaultPolicyPath(preset: PolicyPreset): string {
  return path.join(leluHome(), preset === "general" ? "policy.yaml" : `policy.${preset}.yaml`);
}

async function ensurePolicy(preset: PolicyPreset): Promise<string> {
  const policyPath = process.env["LELU_POLICY_PATH"] ?? defaultPolicyPath(preset);
  if (!fs.existsSync(policyPath)) {
    await fsp.mkdir(path.dirname(policyPath), { recursive: true });
    await fsp.writeFile(policyPath, starterPolicy(preset, displayPath(policyPath)), "utf8");
    console.error(`[lelu-mcp] Starter policy (${preset}) written to ${policyPath} — edit it to change the rules`);
  }
  return policyPath;
}

function displayPath(p: string): string {
  const home = os.homedir();
  return p.startsWith(home + path.sep) ? `~${p.slice(home.length)}` : p;
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
export async function startLocalEngine(opts: { preset?: string } = {}): Promise<LocalEngine> {
  const preset = resolvePreset(opts.preset);
  const [bin, policyPath, apiKey] = await Promise.all([
    resolveBinary(),
    ensurePolicy(preset),
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
