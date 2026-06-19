// Prompt-injection detector for the fallback evaluator.
//
// This is a lightweight TypeScript port of the core layers of the Go engine's
// detector (engine/internal/injection/detector.go). It exists so the hosted
// sandbox and the /v1 fallback still catch obvious injection attempts when the
// real engine is unreachable — instead of silently allowing them.
//
// It is deliberately NOT a replacement for the engine: it ports the high-signal
// layers (exact match, homoglyph normalization, structural density) and skips
// the fuzzy/entropy layers. The engine remains the source of truth.

// Downcased canonical injection phrases (kept in sync with the engine's exactPatterns).
const EXACT_PATTERNS: string[] = [
  // Direct override
  "ignore previous instructions",
  "ignore all previous",
  "ignore all prior",
  "disregard all prior",
  "disregard previous",
  "disregard the above",
  "forget your instructions",
  "forget all previous",
  "override your instructions",
  "override policy",
  "override all policies",
  "override the above",
  // System prompt manipulation
  "system prompt",
  "new system prompt",
  "your new instructions",
  "from now on you",
  "you are now",
  // Role-play injection
  "act as if you",
  "pretend you are",
  "pretend to be",
  "simulate being",
  "imagine you are",
  "roleplay as",
  "you are playing",
  // Jailbreaks
  "jailbreak",
  "do anything now",
  "dan mode",
  "developer mode enabled",
  "god mode",
  "unrestricted mode",
  // Bypass instructions
  "bypass your",
  "ignore your",
  "disregard your",
  "forget you are",
  "without restrictions",
  "no restrictions",
  // Delimiter injection
  "###instruction",
  "[system]",
  "<|system|>",
  "<|im_start|>system",
  "<instructions>",
  "[instructions]",
  // Indirect / context switch
  "ignore safety",
  "ignore ethics",
];

// Higher-weight phrases found in structured attacks.
const STRUCTURAL_INDICATORS: string[] = [
  "ignore",
  "disregard",
  "forget",
  "override",
  "bypass",
  "pretend",
  "roleplay",
  "simulate",
  "act as",
  "from now on",
  "your new",
  "new instructions",
];

// Common unicode lookalikes → ASCII equivalents.
const HOMOGLYPHS: Record<string, string> = {
  "і": "i", "ο": "o", "е": "e", "а": "a", "с": "c",
  "р": "p", "х": "x", "у": "y", "ј": "j", "ԁ": "d",
  "ɡ": "g", "ʜ": "h", "ᴋ": "k", "ʟ": "l", "ᴍ": "m",
  "ɴ": "n", "ǫ": "q", "ʀ": "r", "ꜱ": "s", "ᴛ": "t",
  "ᴠ": "v", "ᴡ": "w", "ᴢ": "z",
  "０": "0", "１": "1", "２": "2", "３": "3", "４": "4",
};

export interface InjectionResult {
  detected: boolean;
  pattern?: string;
  source?: string;
  method?: "exact" | "homoglyph" | "structural";
  score?: number;
}

function normalizeHomoglyphs(s: string): string {
  let changed = false;
  let out = "";
  for (const ch of s) {
    const mapped = HOMOGLYPHS[ch];
    if (mapped !== undefined) {
      out += mapped;
      changed = true;
    } else {
      out += ch;
    }
  }
  return changed ? out : s;
}

// Scans a single text field with the exact + homoglyph layers.
function scanField(text: string, source: string): InjectionResult {
  const lower = text.toLowerCase();
  for (const p of EXACT_PATTERNS) {
    if (lower.includes(p)) {
      return { detected: true, pattern: p, source, method: "exact", score: 1.0 };
    }
  }

  const normalized = normalizeHomoglyphs(text);
  if (normalized !== text) {
    const lowerNorm = normalized.toLowerCase();
    for (const p of EXACT_PATTERNS) {
      if (lowerNorm.includes(p)) {
        return { detected: true, pattern: p, source, method: "homoglyph", score: 0.95 };
      }
    }
  }

  return { detected: false };
}

// Structural layer: 2+ indicators within a 10-word window signals an attack.
function structuralScan(text: string): InjectionResult {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length < 4) return { detected: false };

  const windowSize = 10;
  for (let i = 0; i + windowSize <= words.length; i++) {
    const window = words.slice(i, i + windowSize).join(" ");
    let hits = 0;
    let lastHit = "";
    for (const ind of STRUCTURAL_INDICATORS) {
      if (window.includes(ind)) {
        hits++;
        lastHit = ind;
      }
    }
    if (hits >= 2) {
      return {
        detected: true,
        pattern: lastHit,
        source: "combined",
        method: "structural",
        score: Math.min(hits * 0.3, 1.0),
      };
    }
  }
  return { detected: false };
}

// Recursively flattens any value into scannable strings.
function flatten(value: unknown, out: string[]): void {
  if (value == null) return;
  if (typeof value === "string") {
    out.push(value);
  } else if (typeof value === "number" || typeof value === "boolean") {
    out.push(String(value));
  } else if (Array.isArray(value)) {
    for (const v of value) flatten(v, out);
  } else if (typeof value === "object") {
    for (const v of Object.values(value)) flatten(v, out);
  }
}

export interface DetectInput {
  tool?: string;
  context?: unknown;
  args?: unknown;
  resource?: unknown;
  scope?: unknown;
}

// Runs the full fallback pipeline across every request field — including args,
// resource, and scope, which the engine's tool-name-only fallback used to skip.
export function detectInjection(input: DetectInput): InjectionResult {
  const fields: Array<[string, unknown]> = [
    ["action", input.tool],
    ["context", input.context],
    ["args", input.args],
    ["resource", input.resource],
    ["scope", input.scope],
  ];

  const allText: string[] = [];

  for (const [source, value] of fields) {
    const parts: string[] = [];
    flatten(value, parts);
    for (const part of parts) {
      const r = scanField(part, source);
      if (r.detected) return r;
      allText.push(part);
    }
  }

  // Structural density across the combined text.
  if (allText.length > 0) {
    const r = structuralScan(allText.join(" "));
    if (r.detected) return r;
  }

  return { detected: false };
}
