"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Key,
  Trash2,
  Copy,
  Check,
  Rocket,
  Shield,
  Zap,
  Activity,
  ArrowUpRight,
  ExternalLink,
  Lock,
  Globe,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import FlowBackground from "@/components/modern/FlowBackground";

interface APIKey {
  key: string;
  keyId: string;
  name: string;
  env: string;
  createdAt: string;
  revoked: boolean;
}

interface UsageStats {
  authRequests: number;
  tokenMints: number;
  authQuota: number;
  tokenQuota: number;
  resetDate: string;
}

export default function DashboardPage() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyEnv, setNewKeyEnv] = useState<"live" | "test">("test");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Mock data for premium preview
      setApiKeys([
        {
          key: "9b3a7c2e1f4d8a0b...",
          keyId: "abc123",
          name: "Staging Pipeline",
          env: "test",
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          revoked: false,
        },
        {
          key: "f2e6d9c4a8b1e7f0...",
          keyId: "def456",
          name: "Main Production",
          env: "live",
          createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
          revoked: false,
        },
      ]);

      setUsage({
        authRequests: 6420,
        tokenMints: 215,
        authQuota: 10000,
        tokenQuota: 1000,
        resetDate: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setTimeout(() => setLoading(false), 500); // Smooth transition
    }
  };

  const handleGenerateKey = async () => {
    try {
      const mockKey = `lelu_${newKeyEnv}_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
      setGeneratedKey(mockKey);
      await loadDashboardData();
    } catch (error) {
      console.error("Failed to generate key:", error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-2 border-[#0A0A0A] dark:border-white border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-mono text-zinc-500 uppercase tracking-widest">
            Initializing Foundry...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* Background with custom opacity for dashboard */}
      <div className="fixed inset-0 opacity-40">
        <FlowBackground />
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        {/* Dashboard Header */}
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
              onClick={() => setShowNewKeyModal(true)}
              className="px-4 py-2 text-sm font-bold bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 active:scale-95 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New API Key
            </button>
          </div>
        </div>

        {/* Usage Stats - Glass Cards */}
        {usage && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
            <div className="lg:col-span-2 p-8 rounded-[2rem] border border-zinc-200 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-2xl shadow-xl">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-500/10 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                  </div>
                  <h2 className="text-lg font-bold">Monthly Quota Usage</h2>
                </div>
                <div className="text-xs font-mono text-zinc-500">
                  Resets in{" "}
                  {Math.ceil(
                    (new Date(usage.resetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                  )}{" "}
                  days
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
                      Authorization Requests
                    </div>
                    <div className="text-2xl font-bold">{usage.authRequests.toLocaleString()}</div>
                  </div>
                  <div className="relative h-2 w-full bg-zinc-200 dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-[#0A0A0A] dark:bg-white transition-all duration-1000 ease-out"
                      style={{ width: `${(usage.authRequests / usage.authQuota) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                    <span>Used: {Math.round((usage.authRequests / usage.authQuota) * 100)}%</span>
                    <span>Limit: {usage.authQuota.toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
                      Token Mints
                    </div>
                    <div className="text-2xl font-bold">{usage.tokenMints.toLocaleString()}</div>
                  </div>
                  <div className="relative h-2 w-full bg-zinc-200 dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-emerald-500 transition-all duration-1000 ease-out"
                      style={{ width: `${(usage.tokenMints / usage.tokenQuota) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                    <span>Used: {Math.round((usage.tokenMints / usage.tokenQuota) * 100)}%</span>
                    <span>Limit: {usage.tokenQuota.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 rounded-[2rem] border border-zinc-200 dark:border-white/10 bg-[#0A0A0A] dark:bg-[#141416] shadow-xl overflow-hidden relative group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl -translate-y-12 translate-x-12" />
              <div className="relative z-10 flex flex-col h-full">
                <Shield className="w-10 h-10 text-white/40 mb-6" />
                <h3 className="text-xl font-bold text-white mb-2">Real-time Gating</h3>
                <p className="text-zinc-400 text-sm leading-relaxed mb-8 flex-1">
                  Your agents are being secured by Lelu's active policy engine. Suspicious tool
                  calls are being routed to human review automatically.
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
        )}

        {/* API Keys Table - Premium Glass UI */}
        <div className="rounded-[2.5rem] border border-zinc-200 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-2xl shadow-2xl overflow-hidden">
          <div className="px-8 py-6 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-bold">Authenticated Environments</h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-white/5 uppercase tracking-widest text-[10px] font-bold text-zinc-500">
                  <th className="px-8 py-4">Environment</th>
                  <th className="px-8 py-4">Name</th>
                  <th className="px-8 py-4">Secret Key</th>
                  <th className="px-8 py-4">Created</th>
                  <th className="px-8 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                {apiKeys.map((key) => (
                  <tr
                    key={key.keyId}
                    className="group hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-8 py-5">
                      <Badge
                        className={
                          key.env === "live"
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : "bg-zinc-100 dark:bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
                        }
                      >
                        {key.env.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-8 py-5 font-semibold">{key.name}</td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3 font-mono text-sm text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                        {key.key}
                        <button onClick={() => copyToClipboard(key.key)}>
                          {copiedKey === key.key ? (
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
                    <td className="px-8 py-5 text-right">
                      <button className="text-zinc-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-500/10 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Start for Devs */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-8 rounded-[2rem] bg-zinc-900 text-white flex flex-col gap-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Globe className="w-24 h-24" />
            </div>
            <div className="relative z-10">
              <h3 className="text-xl font-bold mb-2">Connect in Production</h3>
              <p className="text-zinc-400 text-sm mb-6">
                Use your live keys to enforce Lelu policies across your entire agent swarm.
              </p>
              <div className="bg-black/50 rounded-xl p-4 font-mono text-xs border border-white/5">
                <span className="text-emerald-400">const</span> lelu = createClient({"{"} apiKey:{" "}
                <span className="text-amber-400">process.env.LELU_API_KEY</span> {"}"});
              </div>
            </div>
          </div>
          <div className="p-8 rounded-[2rem] bg-zinc-50 dark:bg-zinc-900/20 text-zinc-900 dark:text-white flex flex-col gap-6 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#0A0A0A] dark:bg-white flex items-center justify-center">
                <Rocket className="w-5 h-5 text-white dark:text-[#0A0A0A]" />
              </div>
              <h3 className="text-xl font-bold underline decoration-zinc-400/30 underline-offset-4">
                Explore Automation
              </h3>
            </div>
            <p className="text-sm opacity-80 leading-relaxed">
              Download the Lelu CLI to manage your policies from your local terminal and automate
              deployment pipelines.
            </p>
            <button className="flex items-center gap-2 text-sm font-bold mt-auto hover:gap-4 transition-all uppercase tracking-widest">
              Get the Auth CLI
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>

      {/* New Key Modal - Premium Glass Redesign */}
      {showNewKeyModal && (
        <div className="fixed inset-0 flex items-center justify-center p-6 z-[100]">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowNewKeyModal(false)}
          />
          <div className="relative bg-white dark:bg-zinc-900 rounded-[2.5rem] max-w-md w-full p-10 shadow-2xl border border-zinc-200 dark:border-white/10 overflow-hidden">
            {generatedKey ? (
              <div className="flex flex-col gap-6">
                <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-2">
                  <Lock className="w-8 h-8 text-emerald-500" />
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-bold mb-2">Key Secured</h3>
                  <p className="text-sm text-zinc-500">
                    Save this secret key now. It will never be shown again for security reasons.
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4 font-mono text-xs break-all relative">
                  {generatedKey}
                  <button
                    onClick={() => copyToClipboard(generatedKey)}
                    className="absolute top-2 right-2 p-2 hover:bg-amber-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                  >
                    {copiedKey === generatedKey ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <button
                  onClick={() => {
                    setShowNewKeyModal(false);
                    setGeneratedKey(null);
                    setNewKeyName("");
                  }}
                  className="w-full py-4 bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] rounded-2xl font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                <h3 className="text-2xl font-bold text-center">New Security Access</h3>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-4">
                      Identifier
                    </label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g. Lambda Deployment"
                      className="w-full px-6 py-4 bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-4">
                      Environment
                    </label>
                    <select
                      value={newKeyEnv}
                      onChange={(e) => setNewKeyEnv(e.target.value as "live" | "test")}
                      className="w-full px-6 py-4 bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-500 transition-all font-medium appearance-none"
                    >
                      <option value="test">Sandbox (Development)</option>
                      <option value="live">Live (Production)</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setShowNewKeyModal(false);
                      setNewKeyName("");
                    }}
                    className="flex-1 py-4 border border-zinc-200 dark:border-white/10 rounded-2xl font-bold hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerateKey}
                    disabled={!newKeyName}
                    className="flex-1 py-4 bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] rounded-2xl font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                  >
                    Foundry Key
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
