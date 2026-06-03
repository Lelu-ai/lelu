"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, RefreshCw, AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp, Bot, Key } from "lucide-react";
import FlowBackground from "@/components/modern/FlowBackground";
import { type NHIEntry, type RiskLevel, scoreNHI } from "@/lib/nhi-scoring";

type AgentStatus = "active" | "suspended" | "revoked";
interface ApiKey { id: string; name: string; keyPrefix: string; createdAt: string; lastUsedAt: string | null; expiresAt: string | null; revoked: boolean; }
interface Agent { id: string; name: string; description: string; agentType: string; ownerEmail: string; status: AgentStatus; scopes: string[]; lastSeenAt: string | null; createdAt: string; }

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; dot: string; bg: string }> = {
  critical: { label: "Critical", color: "text-red-700 dark:text-red-400",    dot: "bg-red-500",    bg: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/40" },
  high:     { label: "High",     color: "text-orange-700 dark:text-orange-400", dot: "bg-orange-500", bg: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700/40" },
  medium:   { label: "Medium",   color: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500",  bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/40" },
  low:      { label: "Low",      color: "text-blue-700 dark:text-blue-400",   dot: "bg-blue-500",   bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/40" },
  none:     { label: "None",     color: "text-zinc-500 dark:text-zinc-400",   dot: "bg-zinc-400",   bg: "bg-zinc-50 dark:bg-white/5 border-zinc-200 dark:border-white/10" },
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20",
  high:     "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20",
  medium:   "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20",
  low:      "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20",
};

function RiskBadge({ level }: { level: RiskLevel }) {
  const cfg = RISK_CONFIG[level];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.8 ? "bg-red-500" : score >= 0.55 ? "bg-orange-500" : score >= 0.3 ? "bg-amber-500" : score > 0 ? "bg-blue-500" : "bg-zinc-300 dark:bg-zinc-700";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-zinc-200 dark:bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-zinc-500">{pct}</span>
    </div>
  );
}

function NHICard({ entry }: { entry: NHIEntry }) {
  const [expanded, setExpanded] = useState(false);
  const riskCfg = RISK_CONFIG[entry.riskLevel];

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${riskCfg.bg}`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left p-4 sm:p-5 flex items-start gap-3 sm:gap-4"
      >
        {/* Icon */}
        <div className="mt-0.5 shrink-0">
          {entry.type === "registered_agent"
            ? <Bot className="w-5 h-5 text-violet-500" />
            : <Key className="w-5 h-5 text-amber-500" />
          }
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-semibold text-sm truncate">{entry.name}</span>
            <RiskBadge level={entry.riskLevel} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 bg-zinc-100 dark:bg-white/5 px-2 py-0.5 rounded-full">
              {entry.type === "registered_agent" ? "Agent" : "API Key"}
            </span>
          </div>
          <ScoreBar score={entry.riskScore} />
          {entry.findings.length > 0 && (
            <p className="text-xs text-zinc-500 mt-1.5">
              {entry.findings.length} finding{entry.findings.length !== 1 ? "s" : ""} — {entry.findings[0].title}
              {entry.findings.length > 1 ? ` +${entry.findings.length - 1} more` : ""}
            </p>
          )}
        </div>

        {/* Expand toggle */}
        <div className="shrink-0 text-zinc-400">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Findings detail */}
      {expanded && entry.findings.length > 0 && (
        <div className="border-t border-black/5 dark:border-white/5 px-4 sm:px-5 py-4 space-y-3">
          {entry.findings.map((f, i) => (
            <div key={i} className="rounded-xl bg-white/60 dark:bg-black/20 p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${SEVERITY_COLOR[f.severity]}`}>
                  {f.checkId} · {f.severity.toUpperCase()}
                </span>
                <span className="text-sm font-semibold">{f.title}</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-2">{f.description}</p>
              <div className="flex items-start gap-1.5 text-xs text-zinc-500">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500" />
                <span>{f.remediation}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {expanded && entry.findings.length === 0 && (
        <div className="border-t border-black/5 dark:border-white/5 px-5 py-4 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="w-4 h-4" /> No risk findings detected.
        </div>
      )}
    </div>
  );
}

export default function NHIPage() {
  const [nhis, setNhis] = useState<NHIEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState<RiskLevel | "all">("all");

  const buildNHIs = useCallback(async () => {
    const [agentsRes, keysRes] = await Promise.all([
      fetch("/api/agents"),
      fetch("/api/dashboard/keys"),
    ]);

    const agentData = agentsRes.ok ? await agentsRes.json() : { agents: [] };
    const keyData = keysRes.ok ? await keysRes.json() : { keys: [] };

    const entries: NHIEntry[] = [];

    // Registered agents
    for (const a of (agentData.agents as Agent[]) ?? []) {
      const base = {
        id: a.id,
        type: "registered_agent" as const,
        name: a.name,
        status: a.status,
        scopes: a.scopes ?? [],
        lastSeen: a.lastSeenAt ?? a.createdAt,
        createdAt: a.createdAt,
        agentType: a.agentType,
        ownerEmail: a.ownerEmail,
      };
      const { riskScore, riskLevel, findings } = scoreNHI(base);
      entries.push({ ...base, riskScore, riskLevel, findings });
    }

    // API keys
    for (const k of (keyData.keys as ApiKey[]) ?? []) {
      if (k.revoked) continue;
      const base = {
        id: k.id,
        type: "api_key" as const,
        name: k.name,
        status: "active",
        scopes: [],
        lastSeen: k.lastUsedAt,
        createdAt: k.createdAt,
        keyPrefix: k.keyPrefix,
        expiresAt: k.expiresAt,
      };
      const { riskScore, riskLevel, findings } = scoreNHI(base);
      entries.push({ ...base, riskScore, riskLevel, findings });
    }

    // Sort by risk score descending
    entries.sort((a, b) => b.riskScore - a.riskScore);
    return entries;
  }, []);

  useEffect(() => {
    buildNHIs().then(setNhis).finally(() => setLoading(false));
  }, [buildNHIs]);

  async function handleScan() {
    setScanning(true);
    const fresh = await buildNHIs();
    setNhis(fresh);
    setScanning(false);
  }

  const filtered = filter === "all" ? nhis : nhis.filter(n => n.riskLevel === filter);

  const counts = nhis.reduce((acc, n) => {
    acc[n.riskLevel] = (acc[n.riskLevel] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-2 border-[#0A0A0A] dark:border-white border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-mono text-zinc-500 uppercase tracking-widest">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 opacity-40 pointer-events-none">
        <FlowBackground />
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 sm:mb-12">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white mb-2">
              NHI Inventory
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm sm:text-base">
              Non-human identity posture — agents and API keys scored against OWASP NHI top-10.
            </p>
          </div>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 text-sm font-bold border border-zinc-200 dark:border-white/10 rounded-lg hover:bg-zinc-50 dark:hover:bg-white/5 disabled:opacity-50 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? "animate-spin" : ""}`} />
            {scanning ? "Scanning…" : "Rescan"}
          </button>
        </div>

        {/* Risk summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10">
          {(["critical", "high", "medium", "low"] as RiskLevel[]).map(level => {
            const cfg = RISK_CONFIG[level];
            const count = counts[level] ?? 0;
            return (
              <button
                key={level}
                onClick={() => setFilter(f => f === level ? "all" : level)}
                className={`p-4 sm:p-5 rounded-2xl border text-left transition-all ${
                  filter === level ? cfg.bg : "bg-white/40 dark:bg-black/40 border-zinc-200 dark:border-white/10"
                } hover:scale-[1.02] active:scale-[0.98]`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${cfg.color}`}>{cfg.label}</span>
                </div>
                <p className="text-3xl font-bold text-zinc-900 dark:text-white">{count}</p>
              </button>
            );
          })}
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-xs text-zinc-500 font-medium">Filter:</span>
          {([["all", "All"], ["critical", "Critical"], ["high", "High"], ["medium", "Medium"], ["low", "Low"], ["none", "Clean"]] as [string, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val as RiskLevel | "all")}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                filter === val
                  ? "bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A]"
                  : "bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* NHI list */}
        {nhis.length === 0 ? (
          <div className="text-center py-20">
            <Shield className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500">No identities found. Register an agent or create an API key to get started.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <p className="text-zinc-500 text-sm">No identities in this risk category.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(entry => <NHICard key={entry.id} entry={entry} />)}
          </div>
        )}

        {/* OWASP legend */}
        <div className="mt-10 p-4 sm:p-6 rounded-2xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold">OWASP NHI Checks Active</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-500">
            {[
              ["NHI-01", "Improper offboarding — revoked/stale identities still active"],
              ["NHI-05", "Overprivileged — wildcard or admin-level scopes"],
              ["NHI-07", "Long-lived secrets — no expiry on API keys"],
              ["NHI-10", "No accountable owner assigned"],
            ].map(([id, desc]) => (
              <div key={id} className="flex items-start gap-2">
                <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300 shrink-0">{id}</span>
                <span>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
