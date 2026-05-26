"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Key,
  Trash2,
  Copy,
  Check,
  Shield,
  Activity,
  ArrowUpRight,
  Lock,
  Globe,
} from "lucide-react";
import FlowBackground from "@/components/modern/FlowBackground";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

export default function DashboardPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  // Revoke state
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    fetchKeys();
  }, []);

  async function fetchKeys() {
    try {
      const res = await fetch("/api/dashboard/keys");
      if (!res.ok) throw new Error("Failed to load keys");
      const data = await res.json();
      setApiKeys((data.keys as ApiKey[]).filter((k) => !k.revoked));
    } catch {
      setError("Failed to load API keys. Please refresh.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/dashboard/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Failed to create key");
        return;
      }
      setRevealedKey(data.fullKey);
      await fetchKeys();
    } catch {
      setCreateError("Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    setRevoking(true);
    try {
      const res = await fetch(`/api/dashboard/keys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Revoke failed");
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
    } catch {
      // silently handled — key list will be stale but user can refresh
    } finally {
      setRevoking(false);
      setRevokeId(null);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  function closeCreateModal() {
    setShowCreateModal(false);
    setNewKeyName("");
    setCreateError("");
    setRevealedKey(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-2 border-[#0A0A0A] dark:border-white border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-mono text-zinc-500 uppercase tracking-widest">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 opacity-40">
        <FlowBackground />
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white mb-2">
              Developer Overview
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400">
              Monitor your agent usage and manage security credentials.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/docs"
              className="px-4 py-2 text-sm font-medium border border-zinc-200 dark:border-white/10 rounded-lg hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
            >
              Documentation
            </Link>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 text-sm font-bold bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 active:scale-95 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New API Key
            </button>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          <div className="lg:col-span-2 p-8 rounded-[2rem] border border-zinc-200 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-2xl shadow-xl">
            <div className="flex items-center gap-3 mb-8">
              <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-500/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              </div>
              <h2 className="text-lg font-bold">Active Keys</h2>
            </div>
            <p className="text-5xl font-bold text-zinc-900 dark:text-white">{apiKeys.length}</p>
            <p className="text-sm text-zinc-500 mt-2">
              {apiKeys.length === 0
                ? "No keys yet — create one to get started."
                : apiKeys.length === 1
                ? "1 active API key"
                : `${apiKeys.length} active API keys`}
            </p>
          </div>

          <div className="p-8 rounded-[2rem] border border-zinc-200 dark:border-white/10 bg-[#0A0A0A] dark:bg-[#141416] shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl -translate-y-12 translate-x-12" />
            <div className="relative z-10 flex flex-col h-full">
              <Shield className="w-10 h-10 text-white/40 mb-6" />
              <h3 className="text-xl font-bold text-white mb-2">Real-time Gating</h3>
              <p className="text-zinc-400 text-sm leading-relaxed mb-8 flex-1">
                Your agents are being secured by Lelu's active policy engine.
              </p>
              <Link
                href="/audit"
                className="w-full py-3 bg-white text-[#0A0A0A] rounded-xl font-bold text-sm text-center flex items-center justify-center gap-2 hover:bg-zinc-100 transition-colors"
              >
                View Live Audit Log
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* API Keys Table */}
        <div className="rounded-[2.5rem] border border-zinc-200 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-2xl shadow-2xl overflow-hidden">
          <div className="px-8 py-6 border-b border-zinc-200 dark:border-white/10 flex items-center gap-3">
            <Key className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold">Authenticated Environments</h2>
          </div>

          {error && (
            <div className="px-8 py-4 text-sm text-red-500">{error}</div>
          )}

          {apiKeys.length === 0 && !error ? (
            <div className="px-8 py-16 text-center">
              <Key className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-500 text-sm mb-4">No API keys yet.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 text-sm font-bold bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all"
              >
                Create your first key
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-white/5 uppercase tracking-widest text-[10px] font-bold text-zinc-500">
                    <th className="px-8 py-4">Name</th>
                    <th className="px-8 py-4">Key Prefix</th>
                    <th className="px-8 py-4">Created</th>
                    <th className="px-8 py-4">Last Used</th>
                    <th className="px-8 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                  {apiKeys.map((key) => (
                    <tr
                      key={key.id}
                      className="group hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-8 py-5 font-semibold">{key.name}</td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2 font-mono text-sm text-zinc-500">
                          <span>lelu_sk_{key.keyPrefix}…</span>
                          <button
                            onClick={() => copyToClipboard(`lelu_sk_${key.keyPrefix}`)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Copy prefix"
                          >
                            {copiedKey === `lelu_sk_${key.keyPrefix}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 hover:text-zinc-900 dark:hover:text-zinc-100" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-sm text-zinc-500">
                        {new Date(key.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-8 py-5 text-sm text-zinc-500">
                        {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : "Never"}
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button
                          onClick={() => setRevokeId(key.id)}
                          className="text-zinc-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-500/10 transition-all"
                          title="Revoke key"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Start */}
        <div className="mt-12">
          <div className="p-8 rounded-[2rem] bg-zinc-900 text-white flex flex-col gap-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Globe className="w-24 h-24" />
            </div>
            <div className="relative z-10">
              <h3 className="text-xl font-bold mb-2">Connect in Production</h3>
              <p className="text-zinc-400 text-sm mb-6">
                Use your API key to enforce Lelu policies across your agent swarm.
              </p>
              <div className="bg-black/50 rounded-xl p-4 font-mono text-xs border border-white/5">
                <span className="text-emerald-400">const</span> lelu = createClient({"{"} apiKey:{" "}
                <span className="text-amber-400">process.env.LELU_API_KEY</span> {"}"});
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Create Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 flex items-center justify-center p-6 z-[100]">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeCreateModal}
          />
          <div className="relative bg-white dark:bg-zinc-900 rounded-[2.5rem] max-w-md w-full p-10 shadow-2xl border border-zinc-200 dark:border-white/10">
            {revealedKey ? (
              <div className="flex flex-col gap-6">
                <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-2">
                  <Lock className="w-8 h-8 text-emerald-500" />
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-bold mb-2">Key Created</h3>
                  <p className="text-sm text-zinc-500">
                    Copy this key now — it will never be shown again.
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4 font-mono text-xs break-all relative">
                  {revealedKey}
                  <button
                    onClick={() => copyToClipboard(revealedKey)}
                    className="absolute top-2 right-2 p-2 hover:bg-amber-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                  >
                    {copiedKey === revealedKey ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <button
                  onClick={closeCreateModal}
                  className="w-full py-4 bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] rounded-2xl font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                <h3 className="text-2xl font-bold text-center">New API Key</h3>
                {createError && (
                  <p className="text-sm text-red-500 text-center">{createError}</p>
                )}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-4">
                      Name
                    </label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                      placeholder="e.g. Production Server"
                      className="w-full px-6 py-4 bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-500 transition-all font-medium"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={closeCreateModal}
                    className="flex-1 py-4 border border-zinc-200 dark:border-white/10 rounded-2xl font-bold hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={!newKeyName.trim() || creating}
                    className="flex-1 py-4 bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] rounded-2xl font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                  >
                    {creating ? "Creating…" : "Create Key"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Revoke Confirm Modal */}
      {revokeId && (
        <div className="fixed inset-0 flex items-center justify-center p-6 z-[100]">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setRevokeId(null)}
          />
          <div className="relative bg-white dark:bg-zinc-900 rounded-[2rem] max-w-sm w-full p-8 shadow-2xl border border-zinc-200 dark:border-white/10">
            <h3 className="text-xl font-bold mb-3">Revoke API Key?</h3>
            <p className="text-sm text-zinc-500 mb-8">
              This key will stop working immediately. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRevokeId(null)}
                className="flex-1 py-3 border border-zinc-200 dark:border-white/10 rounded-xl font-bold hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRevoke(revokeId)}
                disabled={revoking}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {revoking ? "Revoking…" : "Revoke"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
