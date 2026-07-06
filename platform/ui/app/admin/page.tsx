"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Activity,
  Key,
  Bot,
  Shield,
  ShieldCheck,
  ShieldX,
  UserPlus,
  Lock,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import FlowBackground from "@/components/modern/FlowBackground";

interface Stats {
  generatedAt: string;
  users: { total: number; verified: number; new24h: number; new7d: number; new30d: number };
  active: { d1: number; d7: number; d30: number };
  resources: {
    activeKeys: number;
    totalKeys: number;
    activeAgents: number;
    totalAgents: number;
    activePolicies: number;
  };
  decisions: {
    total: number;
    total24h: number;
    allowed: number;
    denied: number;
    humanReview: number;
    compute: number;
  };
  signupTrend: { day: string; count: number }[];
  recentSignups: { name: string; email: string; emailVerified: boolean; createdAt: string; lastLoginAt: string | null }[];
  topActive: { email: string; name: string; events: number }[];
}

const cardCls =
  "p-4 sm:p-6 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-xl shadow-sm";

function fmt(n: number) {
  return n.toLocaleString();
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState("");

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/stats", { cache: "no-store" });
      if (res.status === 401 || res.status === 404) {
        setForbidden(true);
        return;
      }
      if (!res.ok) throw new Error("Failed to load");
      setStats(await res.json());
      setForbidden(false);
      setError("");
    } catch {
      setError("Failed to load analytics. Please refresh.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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

  if (forbidden) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black px-6">
        <div className="max-w-sm text-center flex flex-col items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center">
            <Lock className="w-6 h-6 text-zinc-500" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Restricted</h1>
          <p className="text-sm text-zinc-500">
            This dashboard is only available to platform administrators.
          </p>
          <Link href="/dashboard" className="text-sm font-bold hover:underline flex items-center gap-1">
            Back to dashboard <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const maxSignup = Math.max(1, ...(stats?.signupTrend.map((d) => d.count) ?? [1]));

  const primaryStats = [
    {
      label: "Total Users",
      value: stats ? fmt(stats.users.total) : "—",
      sub: stats ? `${fmt(stats.users.verified)} verified` : "",
      icon: <Users className="w-5 h-5 text-blue-500" />,
    },
    {
      label: "Active · 24h",
      value: stats ? fmt(stats.active.d1) : "—",
      sub: stats ? `${fmt(stats.active.d7)} in 7d` : "",
      icon: <Activity className="w-5 h-5 text-emerald-500" />,
    },
    {
      label: "New · 7d",
      value: stats ? fmt(stats.users.new7d) : "—",
      sub: stats ? `${fmt(stats.users.new24h)} today` : "",
      icon: <UserPlus className="w-5 h-5 text-violet-500" />,
    },
    {
      label: "Auth Decisions",
      value: stats ? fmt(stats.decisions.total) : "—",
      sub: stats ? `${fmt(stats.decisions.total24h)} in 24h` : "",
      icon: <Shield className="w-5 h-5 text-amber-500" />,
    },
  ];

  const decisionRows = stats
    ? [
        { label: "Allowed", value: stats.decisions.allowed, icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />, color: "bg-emerald-500" },
        { label: "Denied", value: stats.decisions.denied, icon: <ShieldX className="w-4 h-4 text-red-500" />, color: "bg-red-500" },
        { label: "Human review", value: stats.decisions.humanReview, icon: <Users className="w-4 h-4 text-amber-500" />, color: "bg-amber-500" },
        { label: "Compute", value: stats.decisions.compute, icon: <Activity className="w-4 h-4 text-blue-500" />, color: "bg-blue-500" },
      ]
    : [];
  const decisionTotal = stats ? Math.max(1, stats.decisions.total) : 1;

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 opacity-40">
        <FlowBackground />
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 sm:mb-12">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mb-3 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[10px] font-bold uppercase tracking-widest">
              <Lock className="w-3 h-3" /> Admin only
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white mb-2">
              Platform Analytics
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm sm:text-base">
              {stats ? `Updated ${timeAgo(stats.generatedAt)}` : "Internal metrics across all accounts."}
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="px-4 py-2 text-sm font-medium border border-zinc-200 dark:border-white/10 rounded-lg hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && <div className="mb-6 text-sm text-red-500">{error}</div>}

        {/* Primary stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          {primaryStats.map((s) => (
            <div key={s.label} className={cardCls}>
              <div className="flex items-center gap-2 mb-3">
                {s.icon}
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-zinc-500">
                  {s.label}
                </span>
              </div>
              <p className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white">{s.value}</p>
              {s.sub && <p className="text-xs text-zinc-500 mt-1">{s.sub}</p>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-8">
          {/* Signups trend */}
          <div className={cardCls}>
            <div className="flex items-center gap-2 mb-5">
              <UserPlus className="w-5 h-5 text-violet-500" />
              <h2 className="text-base font-bold">Signups · last 14 days</h2>
            </div>
            {stats && stats.signupTrend.length > 0 ? (
              <div className="flex items-end gap-1 h-32">
                {stats.signupTrend.map((d) => (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="w-full flex items-end h-full">
                      <div
                        className="w-full rounded-t bg-violet-500/80 group-hover:bg-violet-500 transition-all min-h-[2px]"
                        style={{ height: `${(d.count / maxSignup) * 100}%` }}
                        title={`${d.day}: ${d.count}`}
                      />
                    </div>
                    <span className="text-[9px] text-zinc-400">{d.day.slice(5)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500 py-8 text-center">No signups yet.</p>
            )}
          </div>

          {/* Decision breakdown */}
          <div className={cardCls}>
            <div className="flex items-center gap-2 mb-5">
              <Shield className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-bold">Authorization decisions</h2>
            </div>
            <div className="space-y-4">
              {decisionRows.map((r) => (
                <div key={r.label}>
                  <div className="flex items-center justify-between mb-1.5 text-sm">
                    <span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                      {r.icon} {r.label}
                    </span>
                    <span className="font-bold text-zinc-900 dark:text-white">{fmt(r.value)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-white/5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${r.color}`}
                      style={{ width: `${(r.value / decisionTotal) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              {stats && stats.decisions.total === 0 && (
                <p className="text-sm text-zinc-500 py-4 text-center">No decisions recorded yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Resource counts */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
          {stats &&
            [
              { label: "Active API Keys", value: stats.resources.activeKeys, sub: `${fmt(stats.resources.totalKeys)} total`, icon: <Key className="w-5 h-5 text-amber-500" /> },
              { label: "Active Agents", value: stats.resources.activeAgents, sub: `${fmt(stats.resources.totalAgents)} total`, icon: <Bot className="w-5 h-5 text-violet-500" /> },
              { label: "Active Policies", value: stats.resources.activePolicies, sub: " ", icon: <Shield className="w-5 h-5 text-emerald-500" /> },
            ].map((s) => (
              <div key={s.label} className={cardCls}>
                <div className="flex items-center gap-2 mb-2">
                  {s.icon}
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-zinc-500">
                    {s.label}
                  </span>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">{fmt(s.value)}</p>
                <p className="text-xs text-zinc-500 mt-1">{s.sub}</p>
              </div>
            ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Recent signups */}
          <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-white/10 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-violet-500" />
              <h2 className="text-sm font-bold">Recent signups</h2>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-white/5">
              {stats && stats.recentSignups.length > 0 ? (
                stats.recentSignups.map((u) => (
                  <div key={u.email} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{u.name || "—"}</p>
                      <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                      <p className="text-[11px] text-zinc-400 truncate">
                        {u.lastLoginAt ? `Last login ${timeAgo(u.lastLoginAt)}` : "Never logged in"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {u.emailVerified ? (
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <ShieldX className="w-4 h-4 text-zinc-400" />
                      )}
                      <span className="text-xs text-zinc-400">{timeAgo(u.createdAt)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="px-5 py-8 text-sm text-zinc-500 text-center">No users yet.</p>
              )}
            </div>
          </div>

          {/* Most active */}
          <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-white/10 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-bold">Most active · 30 days</h2>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-white/5">
              {stats && stats.topActive.length > 0 ? (
                stats.topActive.map((u, i) => (
                  <div key={u.email} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono text-zinc-400 w-4 shrink-0">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{u.name || u.email}</p>
                        <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-zinc-900 dark:text-white shrink-0">{fmt(u.events)}</span>
                  </div>
                ))
              ) : (
                <p className="px-5 py-8 text-sm text-zinc-500 text-center">No activity yet.</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
