// Lelu's tool-call rules for OpenClaw: which calls to block outright, which to
// pause for the user's approval, and which to let through.
//
// Pure (no OpenClaw imports, no I/O) so every rule is unit tested. These are
// pattern checks on what the agent is about to run, a safety net against the
// obviously dangerous; they are not a sandbox and a determined attacker can
// phrase a command they do not recognise.

export type Verdict = "deny" | "review";

export interface Rule {
  /** Stable id, shown to the user and used in `disableRules`. */
  id: string;
  /** OpenClaw tool names the rule applies to. */
  tools: string[];
  verdict: Verdict;
  /** Why the call is blocked or needs approval, in plain words. */
  reason: string;
  /** Case-insensitive regex tested against the command or code the tool runs. */
  command?: string;
  /** Case-insensitive regex tested against each file path the tool touches. */
  path?: string;
  /**
   * Values of the call's `action` parameter that the rule ignores, for tools
   * such as `plugins` or `gateway` that both read and change things.
   */
  exceptActions?: string[];
}

export interface ToolCall {
  toolName: string;
  params: Record<string, unknown>;
  /** Paths OpenClaw derived from the call (for example from an apply_patch). */
  derivedPaths?: readonly string[];
}

export interface Match {
  rule: Rule;
  verdict: Verdict;
}

// Tools that run commands or code, and the parameters that carry them.
// `bash` and `shell` are the names some agent harnesses give their shell tool;
// `gateway_process` is OpenClaw's background shell.
const RUNTIME_TOOLS = ["exec", "process", "terminal", "code_execution", "bash", "shell", "gateway_process"];
const COMMAND_PARAMS = ["command", "cmd", "code", "script", "input", "data", "keys", "text"];
// Tools that change files, and the parameters that name them.
const FILE_WRITE_TOOLS = ["write", "edit", "apply_patch"];
const PATH_PARAMS = ["path", "file_path", "filePath", "file", "target"];

// A shell word boundary: start, end, whitespace or a command separator.
const END = String.raw`(?=$|[\s;&|)"'])`;
const START = String.raw`(?:^|[\s;&|(])`;
// Flags before rm's target, e.g. `-rf`, `-r -f`, `--no-preserve-root`.
const RM_FLAGS = String.raw`(?:-{1,2}[\w-]+\s+)*`;
const RM_RECURSIVE = String.raw`(?=${RM_FLAGS}-(?:[a-zA-Z]*[rR]|-recursive))`;
const HOME_OR_ROOT = String.raw`["']?(?:/|/\*|~/?\*?|\$HOME/?\*?|\$\{HOME\}/?\*?)["']?`;
const SECRET_FILES = String.raw`(?:\.ssh/|\.aws/credentials|\.netrc|\bid_(?:rsa|ed25519|ecdsa)\b)`;
const NETWORK_TOOLS = String.raw`\b(?:curl|wget|nc|ncat|scp|rsync)\b`;

export const DEFAULT_RULES: readonly Rule[] = [
  // ── Blocked outright: almost never what the user meant ──────────────────
  {
    id: "lelu.rm-home-or-root",
    tools: RUNTIME_TOOLS,
    verdict: "deny",
    reason: "Recursively deletes the whole disk or home folder",
    command: String.raw`\brm\s+${RM_RECURSIVE}${RM_FLAGS}${HOME_OR_ROOT}${END}`,
  },
  {
    id: "lelu.disk-wipe",
    tools: RUNTIME_TOOLS,
    verdict: "deny",
    reason: "Formats or overwrites a disk",
    command: String.raw`\bmkfs(?:\.\w+)?\b|\bdd\b[^\n]*\bof=/dev/(?!null\b|zero\b|stdout\b|stderr\b)|>\s*/dev/(?:sd[a-z]|nvme\d|disk\d|hd[a-z]|mmcblk\d)|\bwipefs\b`,
  },
  {
    id: "lelu.fork-bomb",
    tools: RUNTIME_TOOLS,
    verdict: "deny",
    reason: "Fork bomb: freezes the machine",
    command: String.raw`:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:`,
  },
  {
    id: "lelu.chmod-root",
    tools: RUNTIME_TOOLS,
    verdict: "deny",
    reason: "Makes every file on the system writable by anyone",
    command: String.raw`\bchmod\s+(?:-[a-zA-Z]*R[a-zA-Z]*\s+)(?:0?777|a\+rwx)\s+/${END}`,
  },

  // ── Paused for the user's approval: sometimes right, always worth a look ─
  {
    id: "lelu.pipe-to-shell",
    tools: RUNTIME_TOOLS,
    verdict: "review",
    reason: "Runs a script downloaded from the internet without saving it first",
    command: String.raw`\b(?:curl|wget)\b[^\n|]*\|\s*(?:sudo\s+(?:-\S+\s+)*)?(?:ba|z|da|k|fi)?sh\b`,
  },
  {
    id: "lelu.sudo",
    tools: RUNTIME_TOOLS,
    verdict: "review",
    reason: "Runs a command as administrator (sudo)",
    command: String.raw`${START}sudo\s`,
  },
  {
    id: "lelu.rm-recursive",
    tools: RUNTIME_TOOLS,
    verdict: "review",
    reason: "Deletes a folder and everything in it",
    command: String.raw`\brm\s+${RM_RECURSIVE}`,
  },
  {
    id: "lelu.power",
    tools: RUNTIME_TOOLS,
    verdict: "review",
    reason: "Shuts down or restarts the machine",
    command: String.raw`${START}(?:shutdown|reboot|halt|poweroff)${END}|\binit\s+[06]${END}|\bsystemctl\s+(?:poweroff|reboot|halt)\b`,
  },
  {
    id: "lelu.git-destructive",
    tools: RUNTIME_TOOLS,
    verdict: "review",
    reason: "Rewrites or throws away git history",
    command: String.raw`\bgit\s+(?:push\b[^\n;&|]*\s(?:--force(?:-with-lease)?|-f)${END}|reset\s+--hard\b|clean\s+-[a-zA-Z]*f|branch\s+-D\b)`,
  },
  {
    id: "lelu.database-destructive",
    tools: RUNTIME_TOOLS,
    verdict: "review",
    reason: "Drops or empties a database table",
    command: String.raw`\b(?:drop\s+(?:table|database|schema)|truncate\s+(?:table\s+)?\w+)\b|\bdelete\s+from\s+[\w."]+\s*(?:;|$|["'])`,
  },
  {
    id: "lelu.publish",
    tools: RUNTIME_TOOLS,
    verdict: "review",
    reason: "Publishes a package or release to the public",
    command: String.raw`\b(?:npm|pnpm|yarn|bun)\s+publish\b|\bcargo\s+publish\b|\btwine\s+upload\b|\bgh\s+release\s+create\b|\bdocker\s+push\b`,
  },
  {
    id: "lelu.send-email",
    tools: RUNTIME_TOOLS,
    verdict: "review",
    reason: "Sends an email",
    command: String.raw`${START}(?:sendmail|msmtp|mailx?|mutt)\s|\b(?:himalaya|gog)\b[^\n;&|]*\bsend\b`,
  },
  {
    id: "lelu.payments",
    tools: RUNTIME_TOOLS,
    verdict: "review",
    reason: "Moves money",
    command: String.raw`\bstripe\s+(?:charges|payment_intents|refunds|payouts|transfers|invoices)\s+(?:create|pay|confirm)\b`,
  },
  {
    id: "lelu.secret-exfiltration",
    tools: RUNTIME_TOOLS,
    verdict: "review",
    reason: "Sends a private key or credentials file over the network",
    command: String.raw`${SECRET_FILES}[^\n]*${NETWORK_TOOLS}|${NETWORK_TOOLS}[^\n]*${SECRET_FILES}`,
  },
  {
    id: "lelu.openclaw-config-shell",
    tools: RUNTIME_TOOLS,
    verdict: "review",
    reason: "Installs plugins or skills, or changes OpenClaw's own settings",
    command: String.raw`\bopenclaw\s+(?:plugins?\s+(?:install|enable|update)|skills?\s+install|config\s+(?:set|apply|patch|unset))\b|\bclawhub\s+install\b`,
  },
  {
    id: "lelu.sensitive-file-write",
    tools: FILE_WRITE_TOOLS,
    verdict: "review",
    reason: "Changes a credentials, startup or OpenClaw settings file",
    path: String.raw`(?:^|/)\.ssh/|(?:^|/)\.aws/|(?:^|/)\.gnupg/|(?:^|/)\.env(?:\.[\w.-]+)?$|^/etc/|(?:^|/)\.(?:bashrc|zshrc|profile|bash_profile|zprofile)$|(?:^|/)\.git/hooks/|(?:^|/)\.openclaw/openclaw\.json$`,
  },
  {
    id: "lelu.plugin-changes",
    tools: ["plugins"],
    verdict: "review",
    reason: "Installs, removes or changes an OpenClaw plugin",
    exceptActions: ["list", "inspect", "info", "status", "search", "show", "get"],
  },
  {
    id: "lelu.gateway-changes",
    tools: ["gateway"],
    verdict: "review",
    reason: "Changes or restarts the OpenClaw Gateway",
    exceptActions: ["status", "health", "info", "config.get", "config.schema", "get"],
  },
];

/** The command or code text a runtime tool call will run, joined. */
export function commandText(params: Record<string, unknown>): string {
  return COMMAND_PARAMS.map((k) => params[k])
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .join("\n");
}

/** Every file path a call names, from its parameters and OpenClaw's own hints. */
export function pathsOf(call: ToolCall): string[] {
  const fromParams = PATH_PARAMS.map((k) => call.params[k]).filter((v): v is string => typeof v === "string" && v.length > 0);
  return [...fromParams, ...(call.derivedPaths ?? [])];
}

export interface CompiledRule {
  rule: Rule;
  command?: RegExp;
  path?: RegExp;
}

/** Compiles rules once. Throws with the rule id when a pattern is not valid. */
export function compileRules(rules: readonly Rule[]): CompiledRule[] {
  return rules.map((rule) => {
    try {
      return {
        rule,
        ...(rule.command ? { command: new RegExp(rule.command, "im") } : {}),
        ...(rule.path ? { path: new RegExp(rule.path, "i") } : {}),
      };
    } catch (err) {
      throw new Error(`Lelu rule "${rule.id}" has an invalid pattern: ${(err as Error).message}`);
    }
  });
}

function ruleMatches(c: CompiledRule, call: ToolCall): boolean {
  const { rule } = c;
  if (!rule.tools.includes(call.toolName)) return false;
  const action = typeof call.params.action === "string" ? call.params.action : undefined;
  if (action && rule.exceptActions?.includes(action)) return false;
  if (!c.command && !c.path) return true;
  if (c.command) {
    const text = commandText(call.params);
    if (text && c.command.test(text)) return true;
  }
  if (c.path && pathsOf(call).some((p) => c.path!.test(p))) return true;
  return false;
}

/**
 * The strictest rule a call matches: a deny wins over a review. Returns null
 * when no rule matches, which means the call goes ahead.
 */
export function evaluate(rules: readonly CompiledRule[], call: ToolCall): Match | null {
  let review: Match | null = null;
  for (const c of rules) {
    if (!ruleMatches(c, call)) continue;
    if (c.rule.verdict === "deny") return { rule: c.rule, verdict: "deny" };
    review ??= { rule: c.rule, verdict: "review" };
  }
  return review;
}
