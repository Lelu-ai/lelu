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
 * Everything runs on the user's machine — no account. The only network calls
 * are to GitHub: at each start, a release-list lookup to see whether a newer
 * engine than the cached one exists (skipped when LELU_ENGINE_VERSION pins a
 * version), and a download when one does. If GitHub can't be reached, the
 * cached engine keeps working offline.
 *
 * Environment overrides:
 *   LELU_HOME            data dir (default ~/.lelu)
 *   LELU_ENGINE_BINARY   path to a locally built engine (skips download)
 *   LELU_ENGINE_VERSION  pin a release version, e.g. "0.1.0" (default: newest);
 *                        a cached binary of another version is replaced
 *   LELU_POLICY_PATH     policy file to load (default ~/.lelu/policy.yaml, or
 *                        ~/.lelu/policy.<preset>.yaml for a non-general preset)
 *   LELU_POLICY_PRESET   starter policy preset: general | coding-agent
 *
 * Per-install secrets, generated on first run and kept in LELU_HOME (0600):
 *   engine.key        API_KEY the engine requires from callers
 *   engine.jwt.key    JWT_SIGNING_KEY for minted tokens (an env var overrides it)
 *   engine.vault.key  VAULT_KEY for the OAuth token vault (an env var overrides it)
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
  /** Engine version as reported by /healthz (or the cached release), if known. */
  version?: string;
  /** Terminates the engine child process. */
  stop: () => void;
}

/**
 * Reads the secret stored in `file`, or generates one with `make` and stores
 * it (0600, local only) so it stays the same across restarts.
 */
export async function ensureLocalSecret(file: string, make: () => string): Promise<string> {
  try {
    const existing = (await fsp.readFile(file, "utf8")).trim();
    if (existing) return existing;
  } catch {
    // first run
  }
  const secret = make();
  await fsp.mkdir(path.dirname(file), { recursive: true });
  // "wx": if another lelu-mcp started at the same moment and wrote first,
  // use its secret rather than overwriting it.
  try {
    await fsp.writeFile(file, `${secret}\n`, { mode: 0o600, flag: "wx" });
    return secret;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    const existing = (await fsp.readFile(file, "utf8")).trim();
    if (existing) return existing;
    await fsp.writeFile(file, `${secret}\n`, { mode: 0o600 });
    return secret;
  }
}

/** Secrets the local engine is started with, generated once per install. */
export interface LocalEngineSecrets {
  /** API_KEY: callers present it as a Bearer token. */
  apiKey: string;
  /** JWT_SIGNING_KEY: signs the tokens lelu_mint_token returns. */
  signingKey: string;
  /** VAULT_KEY: encrypts the engine's OAuth token vault. */
  vaultKey: string;
}

/**
 * The engine requires an API key even locally, and without JWT_SIGNING_KEY it
 * signs tokens with a published default that anyone can forge tokens with
 * (VAULT_KEY falls back to that same default). Each is generated once per
 * install and kept in LELU_HOME beside the others.
 */
export async function ensureLocalSecrets(home = leluHome()): Promise<LocalEngineSecrets> {
  const random = () => randomBytes(32).toString("base64url");
  const [apiKey, signingKey, vaultKey] = await Promise.all([
    ensureLocalSecret(path.join(home, "engine.key"), () => `lelu_local_${randomBytes(24).toString("base64url")}`),
    ensureLocalSecret(path.join(home, "engine.jwt.key"), random),
    ensureLocalSecret(path.join(home, "engine.vault.key"), random),
  ]);
  return { apiKey, signingKey, vaultKey };
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

const ENGINE_SOURCE_HINT =
  `Set LELU_ENGINE_VERSION to pin a version (this skips the release lookup), ` +
  `LELU_ENGINE_BINARY to a locally built engine, or LELU_ENGINE_URL to a running one.`;

/**
 * Describes a failed fetch() including its underlying cause. Node reports
 * every network failure as just "fetch failed" and puts the reason (DNS
 * failure, no route to host, refused, timed out...) in `cause`.
 */
export function describeFetchError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const parts = [err.message || err.name];
  let cause: unknown = (err as { cause?: unknown }).cause;
  for (let depth = 0; cause && depth < 3; depth++) {
    if (!(cause instanceof Error)) { parts.push(String(cause)); break; }
    const code = (cause as { code?: unknown }).code;
    // Happy-eyeballs connects fail with an AggregateError whose message is
    // empty; its first inner error has the useful text.
    const inner = cause instanceof AggregateError && cause.errors[0] instanceof Error ? cause.errors[0].message : "";
    const text = cause.message || inner || (typeof code === "string" ? code : cause.name);
    parts.push(typeof code === "string" && !text.includes(code) ? `${code} ${text}` : text);
    cause = (cause as { cause?: unknown }).cause;
  }
  return parts.join(": ");
}

/** Returns the rel="next" URL from a GitHub `Link` header, or null. */
export function nextPageUrl(link: string | null): string | null {
  if (!link) return null;
  for (const part of link.split(",")) {
    const m = part.match(/<([^>]+)>\s*;\s*rel="?next"?/);
    if (m) return m[1]!;
  }
  return null;
}

export interface ReleaseLookupOptions {
  /** GitHub API base URL. Default https://api.github.com (tests use a local server). */
  apiBase?: string;
  /** Stop after this many pages of 100 releases. Default 10. */
  maxPages?: number;
  /** Per-request timeout. Default 15s. */
  timeoutMs?: number;
}

/**
 * Returns the tag of the newest engine release that ships `asset` and a
 * checksums file.
 *
 * Unpinned installs must NOT use GitHub's generic `releases/latest`: a second
 * workflow (oss-release.yml) also publishes `lelu-engine-*` binaries under a
 * `v*` tag but without a checksums file, and "latest" can resolve to either.
 * Filtering the release list by prefix and attached files always lands on a
 * release that has this platform's binary and a matching SHA256SUMS.txt.
 *
 * Several components release from this repository, so the newest engine
 * release is not necessarily on the first page of the list. Pages of 100 are
 * read, following the Link header, until a usable release turns up or
 * `maxPages` is reached.
 */
export async function findLatestEngineRelease(asset: string, opts: ReleaseLookupOptions = {}): Promise<string> {
  const apiBase = (opts.apiBase ?? "https://api.github.com").replace(/\/$/, "");
  const maxPages = opts.maxPages ?? 10;
  const timeoutMs = opts.timeoutMs ?? 15_000;

  let url: string | null = `${apiBase}/repos/${REPO}/releases?per_page=100`;
  let newest: string | undefined;
  let pages = 0;
  while (url && pages < maxPages) {
    pages++;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { "User-Agent": "lelu-mcp", Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new Error(
        `Could not reach ${new URL(url).host} to list Lelu engine releases (${describeFetchError(err)}). ${ENGINE_SOURCE_HINT}`
      );
    }
    if (!res.ok) {
      throw new Error(`Could not list Lelu engine releases (HTTP ${res.status}). ${ENGINE_SOURCE_HINT}`);
    }
    const releases = (await res.json()) as EngineReleaseInfo[];
    newest ??= releases.find((r) => !r.draft && r.tag_name?.startsWith(ENGINE_RELEASE_TAG_PREFIX))?.tag_name;
    const tag = pickEngineRelease(releases, asset);
    if (tag) {
      if (newest && newest !== tag) {
        console.error(`[lelu-mcp] ${newest} has no ${asset} attached yet; using ${tag} instead.`);
      }
      return tag;
    }
    url = nextPageUrl(res.headers.get("link"));
  }
  throw new Error(
    `No "${ENGINE_RELEASE_TAG_PREFIX}*" release of ${REPO} has both ${asset} and ${CHECKSUMS_FILE} attached ` +
    `(searched ${pages} page${pages === 1 ? "" : "s"} of releases). ${ENGINE_SOURCE_HINT}`
  );
}

/** "0.3.1", "v0.3.1" and "engine-v0.3.1" all name the release tag engine-v0.3.1. */
export function engineTagForVersion(version: string): string {
  const v = version.trim().replace(/^engine-v/, "").replace(/^v/, "");
  return `${ENGINE_RELEASE_TAG_PREFIX}${v}`;
}

/**
 * Compares two engine release tags by semantic version. Returns a negative
 * number when a is older, positive when newer, 0 when equal, and null when
 * either tag is not a version this can parse.
 */
export function compareEngineTags(a: string, b: string): number | null {
  const parse = (tag: string) => {
    const m = tag.replace(/^engine-v/, "").replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/);
    return m ? { core: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] } : null;
  };
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i++) {
    if (pa.core[i] !== pb.core[i]) return pa.core[i]! - pb.core[i]!;
  }
  if (pa.pre === pb.pre) return 0;
  if (pa.pre === undefined) return 1; // a release is newer than its prereleases
  if (pb.pre === undefined) return -1;
  return pa.pre < pb.pre ? -1 : 1;
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

  const reason = describeFetchError(lastError);
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

export interface EngineDownloadOptions {
  /** Base URL that release files hang off. Default https://github.com/<repo>/releases/download (tests use a local server). */
  downloadBase?: string;
  /** Passed through to downloadWithResume. */
  attempts?: number;
  backoffMs?: number;
}

/**
 * Downloads `asset` from release `tag`, verifies it against the release's
 * SHA256SUMS.txt and only then writes it to `dest` (atomically, via rename).
 * Returns the verified SHA-256.
 */
export async function downloadEngineRelease(
  tag: string,
  asset: string,
  dest: string,
  opts: EngineDownloadOptions = {},
): Promise<string> {
  const downloadBase = (opts.downloadBase ?? `https://github.com/${REPO}/releases/download`).replace(/\/$/, "");
  const baseUrl = `${downloadBase}/${tag}`;
  const retry = { attempts: opts.attempts, backoffMs: opts.backoffMs };

  console.error(`[lelu-mcp] Downloading Lelu engine ${tag} → ${baseUrl}/${asset}`);

  const onRetry = (attempt: number, err: unknown) =>
    console.error(`[lelu-mcp] Download interrupted (${describeFetchError(err)}); retry ${attempt}…`);

  // Fetch and verify the checksum BEFORE writing anything to disk — refuse to
  // install an engine binary whose integrity can't be confirmed.
  const checksumsUrl = `${baseUrl}/${CHECKSUMS_FILE}`;
  let checksumsText: string;
  try {
    checksumsText = (await downloadWithResume(checksumsUrl, { ...retry, onRetry })).toString("utf8");
  } catch (err) {
    throw new Error(
      `Could not download checksums (${describeFetchError(err)}) — ` +
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
    buf = await downloadWithResume(`${baseUrl}/${asset}`, { ...retry, onProgress, onRetry });
  } catch (err) {
    throw new Error(
      `Engine download failed: ${describeFetchError(err)}. ` +
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
  try {
    await fsp.rename(tmp, dest);
  } catch (err) {
    // e.g. Windows refuses to replace an executable another process is running.
    await fsp.rm(tmp, { force: true });
    throw err;
  }
  console.error(`[lelu-mcp] Engine ${tag} cached at ${dest} (checksum verified)`);
  return actual;
}

// ─── Cached engine version ────────────────────────────────────────────────────
//
// The cached binary keeps a fixed name (~/.lelu/bin/lelu-engine-<os>-<arch>)
// and its release is recorded beside it in <binary>.release.json. Binaries
// cached by older lelu-mcp versions have no such record; their version is
// unknown and they are treated as needing a check.

interface CachedEngineRecord {
  tag: string;
  sha256?: string;
  installedAt?: string;
}

function cacheRecordPath(binary: string): string {
  return `${binary}.release.json`;
}

/** The release tag recorded for the cached binary, or null when unknown. */
export function readCachedEngineTag(binary: string): string | null {
  try {
    const rec = JSON.parse(fs.readFileSync(cacheRecordPath(binary), "utf8")) as Partial<CachedEngineRecord>;
    return typeof rec.tag === "string" && rec.tag.startsWith(ENGINE_RELEASE_TAG_PREFIX) ? rec.tag : null;
  } catch {
    return null;
  }
}

async function writeCachedEngineRecord(binary: string, rec: CachedEngineRecord): Promise<void> {
  const file = cacheRecordPath(binary);
  const tmp = `${file}.tmp-${process.pid}`;
  await fsp.writeFile(tmp, `${JSON.stringify(rec)}\n`, "utf8");
  await fsp.rename(tmp, file);
}

/** Where engine releases come from. Injectable so the upgrade logic can be tested offline. */
export interface EngineReleaseSource {
  /** Tag of the newest usable engine release. Throws when it can't be determined. */
  latestTag(asset: string): Promise<string>;
  /** Downloads and checksum-verifies `tag`'s `asset` into `dest`; returns its SHA-256. */
  download(tag: string, asset: string, dest: string): Promise<string>;
}

export const githubReleaseSource: EngineReleaseSource = {
  latestTag: (asset) => findLatestEngineRelease(asset),
  download: (tag, asset, dest) => downloadEngineRelease(tag, asset, dest),
};

export interface EnsureEngineOptions {
  /** Path of the cached binary. */
  dest: string;
  asset: string;
  /** LELU_ENGINE_VERSION, if set. */
  pinnedVersion?: string;
  source?: EngineReleaseSource;
  log?: (message: string) => void;
}

/**
 * Makes sure `dest` holds the engine to run and returns its release tag
 * (null when it is a legacy cached binary of unknown version that could not
 * be replaced).
 *
 * - Pinned (LELU_ENGINE_VERSION): the cached binary is used only if it is
 *   that release; otherwise the pinned release is downloaded. No release
 *   lookup is made, so a pin works without api.github.com.
 * - Unpinned: the newest engine release is looked up and downloaded when it
 *   is newer than the cached one (or the cached one's version is unknown).
 *   If the lookup or the download fails, the cached binary keeps working
 *   offline and a notice says so.
 *
 * Every download is checksum-verified before it replaces the cached binary.
 */
export async function ensureEngineBinary(opts: EnsureEngineOptions): Promise<string | null> {
  const { dest, asset } = opts;
  const source = opts.source ?? githubReleaseSource;
  const log = opts.log ?? ((m: string) => console.error(`[lelu-mcp] ${m}`));
  const cached = fs.existsSync(dest);
  const cachedTag = cached ? readCachedEngineTag(dest) : null;
  const cachedName = cachedTag ?? "a cached engine of unknown version";

  const install = async (tag: string): Promise<string> => {
    const sha256 = await source.download(tag, asset, dest);
    await writeCachedEngineRecord(dest, { tag, sha256, installedAt: new Date().toISOString() });
    return tag;
  };

  const pinned = opts.pinnedVersion?.trim();
  if (pinned) {
    const want = engineTagForVersion(pinned);
    if (cached && cachedTag === want) return want;
    if (cached) log(`LELU_ENGINE_VERSION asks for ${want}; replacing ${cachedName}.`);
    try {
      return await install(want);
    } catch (err) {
      if (cached && cachedTag === null) {
        // A legacy cache may well be the pinned release; it is better than nothing offline.
        log(`Could not download ${want} (${errorText(err)}). Using ${cachedName} instead.`);
        return null;
      }
      if (cached) {
        throw new Error(
          `Could not download ${want}, which LELU_ENGINE_VERSION asks for (${errorText(err)}). ` +
          `The cached engine is ${cachedTag}; unset LELU_ENGINE_VERSION to run it.`
        );
      }
      throw err;
    }
  }

  let latest: string;
  try {
    latest = await source.latestTag(asset);
  } catch (err) {
    if (!cached) throw err;
    log(`Could not check for a newer engine: ${errorText(err)}`);
    log(`Continuing offline with ${cachedName}.`);
    return cachedTag;
  }

  if (cached && cachedTag) {
    const cmp = compareEngineTags(latest, cachedTag);
    if (cmp === 0 || (cmp !== null && cmp < 0)) return cachedTag; // up to date (or newer, e.g. pinned before)
  }
  if (cached) log(`Upgrading ${cachedName} to ${latest}.`);
  try {
    return await install(latest);
  } catch (err) {
    if (!cached) throw err;
    log(`Could not download ${latest} (${errorText(err)}). Continuing with ${cachedName}.`);
    return cachedTag;
  }
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function resolveBinary(): Promise<{ path: string; tag: string | null }> {
  const explicit = process.env["LELU_ENGINE_BINARY"];
  if (explicit) {
    if (!fs.existsSync(explicit)) {
      throw new Error(`LELU_ENGINE_BINARY points to a missing file: ${explicit}`);
    }
    return { path: explicit, tag: null };
  }
  const asset = assetName();
  const dest = path.join(leluHome(), "bin", asset);
  const tag = await ensureEngineBinary({ dest, asset, pinnedVersion: process.env["LELU_ENGINE_VERSION"] });
  return { path: dest, tag };
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

/** Waits for /healthz to answer and returns the version it reports, if any. */
async function waitHealthy(url: string, child: ChildProcess, timeoutMs = 15_000): Promise<string | undefined> {
  const deadline = Date.now() + timeoutMs;
  let exited = false;
  child.once("exit", () => { exited = true; });
  while (Date.now() < deadline) {
    if (exited) throw new Error("Lelu engine exited during startup — see log lines above.");
    try {
      const res = await fetch(`${url}/healthz`, { signal: AbortSignal.timeout(1_000) });
      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as { version?: unknown };
        return typeof body.version === "string" ? body.version : undefined;
      }
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
  const [bin, policyPath, secrets] = await Promise.all([
    resolveBinary(),
    ensurePolicy(preset),
    ensureLocalSecrets(),
  ]);
  const { apiKey } = secrets;
  const home = leluHome();
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;

  const child = spawn(bin.path, [], {
    env: {
      // Dev-mode confidence defaults: MCP hosts cannot produce verified
      // provider signals (logprobs/entropy), so accept self-reported
      // confidence and route signal-less requests to human review instead of
      // hard-denying. Listed before the spread so your env vars override them.
      CONFIDENCE_ALLOW_UNVERIFIED: "true",
      CONFIDENCE_MISSING_MODE: "review",
      // Per-install secrets instead of the engine's published defaults. Also
      // before the spread, so a JWT_SIGNING_KEY / VAULT_KEY you set wins.
      JWT_SIGNING_KEY: secrets.signingKey,
      VAULT_KEY: secrets.vaultKey,
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

  let reported: string | undefined;
  try {
    reported = await waitHealthy(url, child);
    await writeRuntimeFile();
  } catch (err) {
    stop();
    throw err;
  }

  // Say which engine is running: the version it reports, and where it came from.
  const version = reported ?? (bin.tag ? bin.tag.slice(ENGINE_RELEASE_TAG_PREFIX.length) : undefined);
  const origin = process.env["LELU_ENGINE_BINARY"] ? "LELU_ENGINE_BINARY"
    : bin.tag ? `release ${bin.tag}`
    : "cached binary of unrecorded release";
  console.error(`[lelu-mcp] Local Lelu engine ${version ?? "(version not reported)"} ready on ${url}`);
  console.error(`[lelu-mcp]   Engine binary : ${bin.path} (${origin})`);
  console.error(`[lelu-mcp]   Policy        : ${policyPath}`);
  return { url, apiKey, version, stop };
}
