"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function KeyRow({
  k,
  onRevoke,
}: {
  k: ApiKey;
  onRevoke: (id: string, name: string) => void;
}) {
  return (
    <div className="flex items-center gap-4 py-4 border-b border-[#E7E5E4] dark:border-[#222224] last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[14px] font-medium text-[#0A0A0A] dark:text-white truncate">
            {k.name}
          </span>
          {k.revoked && (
            <span className="shrink-0 px-1.5 py-0.5 rounded text-[11px] font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200/60 dark:border-red-800/40">
              Revoked
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <code className="text-[12px] font-mono text-[#737373]">
            lelu_sk_{k.keyPrefix}••••••••••••••
          </code>
          <span className="text-[12px] text-[#A3A3A3]">
            Created {formatDate(k.createdAt)}
          </span>
          <span className="text-[12px] text-[#A3A3A3]">
            Last used {formatDate(k.lastUsedAt)}
          </span>
        </div>
      </div>
      {!k.revoked && (
        <button
          onClick={() => onRevoke(k.id, k.name)}
          className="shrink-0 text-[12px] text-[#737373] hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          Revoke
        </button>
      )}
    </div>
  );
}

// ── Create Modal ──────────────────────────────────────────────────────────────

function CreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (key: ApiKey, fullKey: string) => void;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create key");
        return;
      }
      onCreated(data.key, data.fullKey);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-[420px] bg-white dark:bg-[#111113] border border-[#E7E5E4] dark:border-[#222224] rounded-2xl p-7 shadow-xl">
        <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-1">
          Create API key
        </h2>
        <p className="text-[13px] text-[#737373] mb-6">
          Give your key a name so you can identify it later.
        </p>

        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div className="px-3.5 py-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200/70 dark:border-red-800/40 text-[13px] text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="key-name"
              className="block text-[13px] font-medium text-[#0A0A0A] dark:text-[#E4E4E7]"
            >
              Key name
            </label>
            <input
              id="key-name"
              type="text"
              autoFocus
              required
              maxLength={64}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production, Local dev, CI"
              className="w-full h-11 px-3.5 rounded-lg border border-[#E7E5E4] dark:border-[#2A2A2C] bg-white dark:bg-[#18181B] text-[#0A0A0A] dark:text-white placeholder:text-[#A3A3A3] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20 dark:focus:ring-white/10 focus:border-[#0A0A0A] dark:focus:border-white/30 transition-all"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-lg border border-[#E7E5E4] dark:border-[#2A2A2C] text-[14px] font-medium text-[#737373] dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#18181B] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 h-11 rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] text-[14px] font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Creating…" : "Create key"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Reveal Modal ──────────────────────────────────────────────────────────────

function RevealModal({
  keyName,
  fullKey,
  onClose,
}: {
  keyName: string;
  fullKey: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(fullKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-[480px] bg-white dark:bg-[#111113] border border-[#E7E5E4] dark:border-[#222224] rounded-2xl p-7 shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <div>
            <h2 className="text-[17px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white">
              Key created
            </h2>
            <p className="text-[13px] text-[#737373]">{keyName}</p>
          </div>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200/70 dark:border-amber-800/40 text-[13px] text-amber-700 dark:text-amber-400 mb-4">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>
            <strong>Copy this key now.</strong> It won&apos;t be shown again — we only store a hash.
          </span>
        </div>

        {/* Key block */}
        <div className="bg-[#0A0A0A] rounded-xl p-4 mb-4">
          <code className="block text-[12px] font-mono text-emerald-400 break-all leading-relaxed">
            {fullKey}
          </code>
        </div>

        <div className="flex gap-3">
          <button
            onClick={copy}
            className="flex-1 h-11 rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] text-[14px] font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy key
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-lg border border-[#E7E5E4] dark:border-[#2A2A2C] text-[14px] font-medium text-[#737373] hover:bg-zinc-50 dark:hover:bg-[#18181B] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Revoke Confirm Modal ──────────────────────────────────────────────────────

function RevokeModal({
  keyName,
  onConfirm,
  onClose,
  loading,
}: {
  keyName: string;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-[400px] bg-white dark:bg-[#111113] border border-[#E7E5E4] dark:border-[#222224] rounded-2xl p-7 shadow-xl">
        <h2 className="text-[17px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-2">
          Revoke key?
        </h2>
        <p className="text-[14px] text-[#737373] mb-6 leading-relaxed">
          <strong className="text-[#0A0A0A] dark:text-white">{keyName}</strong> will
          stop working immediately. Any application using it will lose access.
          This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-lg border border-[#E7E5E4] dark:border-[#2A2A2C] text-[14px] font-medium text-[#737373] hover:bg-zinc-50 dark:hover:bg-[#18181B] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 h-11 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[14px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Revoking…" : "Yes, revoke"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ApiKeyPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [revealData, setRevealData] = useState<{ key: ApiKey; fullKey: string } | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/keys")
      .then((r) => {
        // API keys require an account — send anonymous visitors to sign in.
        if (r.status === 401) {
          router.replace("/login?next=/api-key");
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d) setKeys(d.keys ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  function handleCreated(key: ApiKey, fullKey: string) {
    setShowCreate(false);
    setKeys((prev) => [key, ...prev]);
    setRevealData({ key, fullKey });
  }

  async function handleRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await fetch(`/api/dashboard/keys/${revokeTarget.id}`, { method: "DELETE" });
      setKeys((prev) =>
        prev.map((k) =>
          k.id === revokeTarget.id ? { ...k, revoked: true } : k
        )
      );
    } finally {
      setRevoking(false);
      setRevokeTarget(null);
    }
  }

  const activeKeys = keys.filter((k) => !k.revoked);
  const revokedKeys = keys.filter((k) => k.revoked);

  return (
    <>
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
      {revealData && (
        <RevealModal
          keyName={revealData.key.name}
          fullKey={revealData.fullKey}
          onClose={() => setRevealData(null)}
        />
      )}
      {revokeTarget && (
        <RevokeModal
          keyName={revokeTarget.name}
          onConfirm={handleRevoke}
          onClose={() => setRevokeTarget(null)}
          loading={revoking}
        />
      )}

      <main className="min-h-screen bg-[#FAFAFA] dark:bg-[#0B0B0C] pt-24 md:pt-32 pb-20 px-4">
        <div className="max-w-2xl mx-auto">

          {/* Header */}
          <div className="flex items-start justify-between mb-10 gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E7E5E4] dark:border-[#222224] bg-white dark:bg-[#141416] px-4 py-1.5 text-[13px] text-zinc-500 dark:text-zinc-400 mb-5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0A0A0A] dark:bg-white" />
                API Keys
              </div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0A0A0A] dark:text-white lowercase mb-2">
                your api keys.
              </h1>
              <p className="text-zinc-500 dark:text-zinc-400 text-[15px] leading-relaxed">
                Keys authenticate your application with the Lelu engine. Each key is shown only once at creation.
              </p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="shrink-0 h-10 px-4 rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] text-[13px] font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors flex items-center gap-2 mt-1"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New key
            </button>
          </div>

          {/* Active Keys */}
          <div className="bg-white dark:bg-[#111113] border border-[#E7E5E4] dark:border-[#222224] rounded-xl overflow-hidden mb-4">
            <div className="px-6 py-4 border-b border-[#E7E5E4] dark:border-[#222224] flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-[#0A0A0A] dark:text-white">
                Active keys
              </h2>
              <span className="text-[12px] text-[#A3A3A3]">
                {activeKeys.length} {activeKeys.length === 1 ? "key" : "keys"}
              </span>
            </div>

            <div className="px-6">
              {loading ? (
                <div className="py-12 text-center text-[14px] text-[#A3A3A3]">
                  Loading…
                </div>
              ) : activeKeys.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-10 h-10 rounded-full bg-[#F4F4F5] dark:bg-[#27272A] flex items-center justify-center mx-auto mb-3">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A3A3A3" strokeWidth="1.5">
                      <path d="m21 2-1 1M3.5 20.5l1-1M9 3.5l.7.7M14.3 20.3l.7.7M3.5 3.5l1 1M20.3 20.3l.7-.7M20.5 9h-1M4.5 15H3M17 7l-10 10M9 7l8 8" />
                      <circle cx="17" cy="7" r="3" />
                    </svg>
                  </div>
                  <p className="text-[14px] text-[#737373] mb-1">No active keys</p>
                  <p className="text-[13px] text-[#A3A3A3]">
                    Create your first key to start making API requests.
                  </p>
                </div>
              ) : (
                activeKeys.map((k) => (
                  <KeyRow
                    key={k.id}
                    k={k}
                    onRevoke={(id, name) => setRevokeTarget({ id, name })}
                  />
                ))
              )}
            </div>
          </div>

          {/* Quick Start (visible only when there are active keys) */}
          {activeKeys.length > 0 && (
            <div className="bg-white dark:bg-[#111113] border border-[#E7E5E4] dark:border-[#222224] rounded-xl p-6 mb-4">
              <h3 className="text-[14px] font-semibold text-[#0A0A0A] dark:text-white mb-4">
                Quick start
              </h3>
              <div className="space-y-3">
                {[
                  { label: "1. Install the SDK", code: "npm install lelu-agent-auth" },
                  { label: "2. Add to your .env", code: "LELU_API_KEY=lelu_sk_••••••••••••••" },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-[12px] font-medium text-[#A3A3A3] mb-1.5">{item.label}</p>
                    <div className="bg-[#0A0A0A] rounded-lg px-4 py-3">
                      <code className="text-[12px] font-mono text-emerald-400">{item.code}</code>
                    </div>
                  </div>
                ))}
                <div>
                  <p className="text-[12px] font-medium text-[#A3A3A3] mb-1.5">3. Authorize an agent action</p>
                  <div className="bg-[#0A0A0A] rounded-lg px-4 py-3 overflow-x-auto">
                    <pre className="text-[12px] font-mono text-emerald-400">{`import { createClient } from "lelu-agent-auth";

const lelu = createClient({ apiKey: process.env.LELU_API_KEY });

const decision = await lelu.agentAuthorize({
  actor: "invoice_bot",
  action: "approve_refunds",
  resource: { amount: "500" },
});

if (!decision.allowed) throw new Error(decision.reason);`}</pre>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <Link
                  href="/docs/quickstart"
                  className="flex-1 py-2.5 bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] rounded-lg text-center text-[13px] font-semibold hover:opacity-90 transition-opacity"
                >
                  Full documentation
                </Link>
                <Link
                  href="/docs"
                  className="flex-1 py-2.5 border border-[#E7E5E4] dark:border-[#222224] text-zinc-700 dark:text-zinc-300 rounded-lg text-center text-[13px] font-medium hover:bg-zinc-50 dark:hover:bg-[#141416] transition-colors"
                >
                  View examples
                </Link>
              </div>
            </div>
          )}

          {/* Revoked Keys (collapsed section) */}
          {revokedKeys.length > 0 && (
            <details className="group bg-white dark:bg-[#111113] border border-[#E7E5E4] dark:border-[#222224] rounded-xl overflow-hidden">
              <summary className="px-6 py-4 cursor-pointer list-none flex items-center justify-between select-none">
                <span className="text-[14px] font-semibold text-[#737373]">
                  Revoked keys ({revokedKeys.length})
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#A3A3A3"
                  strokeWidth="2"
                  className="transition-transform group-open:rotate-180"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </summary>
              <div className="px-6 border-t border-[#E7E5E4] dark:border-[#222224]">
                {revokedKeys.map((k) => (
                  <KeyRow
                    key={k.id}
                    k={k}
                    onRevoke={() => {}}
                  />
                ))}
              </div>
            </details>
          )}

        </div>
      </main>
    </>
  );
}
