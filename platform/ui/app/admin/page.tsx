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
  AlertTriangle,
  Search,
} from "lucide-react";
import FlowBackground from "@/components/modern/FlowBackground";

// Every section can be null: the API loads each one on its own and reports a
// failed section in `errors` instead of failing the whole page.
interface Stats {
  generatedAt: string;
  users: { total: number; verified: number; unverified: number; new24h: number; new7d: number; new30d: number } | null;
  active: { d1: number; d7: number; d30: number } | null;
  resources: {
    activeKeys: number;
    totalKeys: number;
    activeAgents: number;
    totalAgents: number;
    activePolicies: number;
  } | null;
  decisions: {
    total: number;
    total24h: number;
    allowed: number;
    denied: number;
    humanReview: number;
    compute: number;
    sandbox: number;
  } | null;
  signupTrend: { day: string; count: number }[] | null;
  userList:
    | { name: string; email: string; emailVerified: boolean; plan: string; createdAt: string; lastLoginAt: string | null }[]
    | null;
  userListLimit: number;
  topActive: { email: string; name: string; events: number }[] | null;
  errors: Record<string, string>;
}

type UserFilter = "all" | "verified" | "unverified";

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
  const [userFilter, setUserFilter] = useState<UserFilter>("all");
  const [query, setQuery] = useState("");

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/stats", { cache: "no-store" });
      if (res.status === 401 || res.status === 404) {
        setForbidden(true);
        return;
      }
      if (!res.ok) {
        // Show what the server said, not a generic message, so the cause can
        // be tracked down (a 504 here means the request timed out).
        const body = await res.json().catch(() => null);
        const detail = body && typeof body.error === "string" ? body.error : res.statusText || "no details";
        throw new Error(`HTTP ${res.status}: ${detail}`);
      }
      setStats(await res.json());
      setForbidden(false);
      setError("");
    } catch (err) {
      setError(`Failed to load analytics (${err instanceof Error ? err.message : String(err)}).`);
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

  const users = stats?.users ?? null;
  const active = stats?.active ?? null;
  const decisions = stats?.decisions ?? null;
  const resources = stats?.resources ?? null;
  const signupTrend = stats?.signupTrend ?? null;
  const userList = stats?.userList ?? null;
  const topActive = stats?.topActive ?? null;
  const sectionErrors = Object.entries(stats?.errors ?? {});

  const maxSignup = Math.max(1, ...(signupTrend?.map((d) => d.count) ?? [1]));

  const primaryStats = [
    {
      label: "Total Users",
      value: users ? fmt(users.total) : "—",
      sub: users ? `${fmt(users.verified)} verified · ${fmt(users.unverified)} unverified` : "",
      icon: <Users className="w-5 h-5 text-blue-500" />,
    },
    {
      label: "Active · 24h",
      value: active ? fmt(active.d1) : "—",
      sub: active ? `${fmt(active.d7)} in 7d` : "",
      icon: <Activity className="w-5 h-5 text-emerald-500" />,
    },
    {
      label: "New · 7d",
      value: users ? fmt(users.new7d) : "—",
      sub: users ? `${fmt(users.new24h)} today` : "",
      icon: <UserPlus className="w-5 h-5 text-violet-500" />,
    },
    {
      label: "Auth Decisions",
      value: decisions ? fmt(decisions.total) : "—",
      sub: decisions ? `${fmt(decisions.total24h)} in 24h · live calls only` : "",
      icon: <Shield className="w-5 h-5 text-amber-500" />,
    },
  ];

  const decisionRows = decisions
    ? [
        { label: "Allowed", value: decisions.allowed, icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />, color: "bg-emerald-500" },
        { label: "Denied", value: decisions.denied, icon: <ShieldX className="w-4 h-4 text-red-500" />, color: "bg-red-500" },
        { label: "Human review", value: decisions.humanReview, icon: <Users className="w-4 h-4 text-amber-500" />, color: "bg-amber-500" },
        { label: "Compute", value: decisions.compute, icon: <Activity className="w-4 h-4 text-blue-500" />, color: "bg-blue-500" },
      ]
    : [];
  const decisionTotal = decisions ? Math.max(1, decisions.total) : 1;

  const q = query.trim().toLowerCase();
  const filteredUsers = (userList ?? []).filter((u) => {
    if (userFilter === "verified" && !u.emailVerified) return false;
    if (userFilter === "unverified" && u.emailVerified) return false;
    return !q || u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q);
  });
  const listCounts = {
    all: userList?.length ?? 0,
    verified: userList?.filter((u) => u.emailVerified).length ?? 0,
    unverified: userList?.filter((u) => !u.emailVerified).length ?? 0,
  };

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

        {error && <div className="mb-6 text-sm text-red-500 break-words">{error}</div>}

        {sectionErrors.length > 0 && (
          <div className="mb-6 p-4 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50/70 dark:bg-red-500/10 text-sm">
            <p className="flex items-center gap-2 font-bold text-red-600 dark:text-red-400 mb-2">
              <AlertTriangle className="w-4 h-4" /> Some sections could not load
            </p>
            <ul className="space-y-1 text-red-600/90 dark:text-red-300/90 font-mono text-xs">
              {sectionErrors.map(([name, msg]) => (
                <li key={name} className="break-words">
                  <span className="font-bold">{name}:</span> {msg}
                </li>
              ))}
            </ul>
          </div>
        )}

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
            {signupTrend && signupTrend.length > 0 ? (
              <div className="flex items-end gap-1 h-32">
                {signupTrend.map((d) => (
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
              <p className="text-sm text-zinc-500 py-8 text-center">
                {signupTrend ? "No signups yet." : "Not available."}
              </p>
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
              {decisions && decisions.total === 0 && (
                <p className="text-sm text-zinc-500 py-4 text-center">No live decisions recorded yet.</p>
              )}
              {!decisions && <p className="text-sm text-zinc-500 py-4 text-center">Not available.</p>}
              {decisions && (
                <p className="text-xs text-zinc-500">
                  Live API calls only. {fmt(decisions.sandbox)} sandbox demo calls are not counted.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Resource counts */}
        {resources && (
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
            {[
              { label: "Active API Keys", value: resources.activeKeys, sub: `${fmt(resources.totalKeys)} total`, icon: <Key className="w-5 h-5 text-amber-500" /> },
              { label: "Active Agents", value: resources.activeAgents, sub: `${fmt(resources.totalAgents)} total`, icon: <Bot className="w-5 h-5 text-violet-500" /> },
              { label: "Active Policies", value: resources.activePolicies, sub: " ", icon: <Shield className="w-5 h-5 text-emerald-500" /> },
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
        )}

        {/* All users, verified and unverified */}
        <div className="mb-8 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-bold">Users</h2>
              {userList && stats && userList.length >= stats.userListLimit && (
                <span className="text-[11px] text-zinc-400">newest {fmt(stats.userListLimit)}</span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex rounded-lg border border-zinc-200 dark:border-white/10 overflow-hidden text-xs font-medium">
                {(["all", "verified", "unverified"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setUserFilter(f)}
                    className={`px-3 py-1.5 capitalize transition-colors ${
                      userFilter === f
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                        : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5"
                    }`}
                  >
                    {f} ({fmt(listCounts[f])})
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-white/10 text-xs">
                <Search className="w-3.5 h-3.5 text-zinc-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or email"
                  className="bg-transparent outline-none w-full sm:w-44 text-zinc-900 dark:text-white placeholder:text-zinc-400"
                />
              </label>
            </div>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-white/5 max-h-[520px] overflow-y-auto">
            {!userList ? (
              <p className="px-5 py-8 text-sm text-zinc-500 text-center">Not available.</p>
            ) : filteredUsers.length === 0 ? (
              <p className="px-5 py-8 text-sm text-zinc-500 text-center">No users match.</p>
            ) : (
              filteredUsers.map((u) => (
                <div key={u.email} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{u.name || "—"}</p>
                    <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                    <p className="text-[11px] text-zinc-400 truncate">
                      Joined {u.createdAt ? timeAgo(u.createdAt) : "—"} ·{" "}
                      {u.lastLoginAt ? `last login ${timeAgo(u.lastLoginAt)}` : "never logged in"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] px-2 py-0.5 rounded-full border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300 capitalize">
                      {u.plan}
                    </span>
                    {u.emailVerified ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="w-3.5 h-3.5" /> Verified
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <ShieldX className="w-3.5 h-3.5" /> Unverified
                      </span>
                    )}
                  </div>
                </div>
              ))
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
            {topActive && topActive.length > 0 ? (
              topActive.map((u, i) => (
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
              <p className="px-5 py-8 text-sm text-zinc-500 text-center">
                {topActive ? "No live activity yet." : "Not available."}
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
