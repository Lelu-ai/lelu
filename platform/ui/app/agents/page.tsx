"use client";

import { useState, useEffect } from "react";
import {
  Bot, Plus, Trash2, PauseCircle, Zap, ChevronDown,
  Shield, Clock, Tag, CheckCircle, XCircle, AlertCircle,
} from "lucide-react";
import FlowBackground from "@/components/modern/FlowBackground";

type AgentType = "autonomous" | "assistant" | "workflow";
type AgentStatus = "active" | "suspended" | "revoked";

interface Agent {
  id: string;
  name: string;
  description: string;
  agentType: AgentType;
  ownerEmail: string;
  status: AgentStatus;
  scopes: string[];
  lastSeenAt: string | null;
  createdAt: string;
}

const TYPE_LABELS: Record<AgentType, string> = {
  autonomous: "Autonomous",
  assistant: "Assistant",
  workflow: "Workflow",
};

const STATUS_CONFIG: Record<AgentStatus, { label: string; icon: React.ReactNode; color: string }> = {
  active:    { label: "Active",    icon: <CheckCircle className="w-3.5 h-3.5" />, color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700/40" },
  suspended: { label: "Suspended", icon: <AlertCircle className="w-3.5 h-3.5" />, color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/40" },
  revoked:   { label: "Revoked",   icon: <XCircle className="w-3.5 h-3.5" />,     color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/40" },
};

function StatusBadge({ status }: { status: AgentStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function formatAgo(ts: string | null): string {
  if (!ts) return "Never";
  const delta = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", agentType: "autonomous" as AgentType, ownerEmail: "", scopes: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Action states
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"revoke" | "suspend" | null>(null);
  const [actioning, setActioning] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => { fetchAgents(); }, []);

  async function fetchAgents() {
    try {
      const res = await fetch("/api/agents");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAgents(data.agents ?? []);
    } catch {
      setError("Failed to load agents. Please refresh.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!form.name.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          agentType: form.agentType,
          ownerEmail: form.ownerEmail.trim(),
          scopes: form.scopes.split(",").map(s => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error || "Failed to create agent"); return; }
      setAgents(prev => [data.agent, ...prev]);
      setShowCreate(false);
      setForm({ name: "", description: "", agentType: "autonomous", ownerEmail: "", scopes: "" });
    } catch {
      setCreateError("Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleAction() {
    if (!actionId || !actionType) return;
    setActioning(true);
    try {
      const url = actionType === "revoke"
        ? `/api/agents/${actionId}`
        : `/api/agents/${actionId}/suspend`;
      const method = actionType === "revoke" ? "DELETE" : "POST";
      const res = await fetch(url, { method });
      if (!res.ok) throw new Error();
      const newStatus: AgentStatus = actionType === "revoke" ? "revoked" : "suspended";
      setAgents(prev => prev.map(a => a.id === actionId ? { ...a, status: newStatus } : a));
    } catch {
      // silently fail — stale state is acceptable
    } finally {
      setActioning(false);
      setActionId(null);
      setActionType(null);
    }
  }

  const activeCount = agents.filter(a => a.status === "active").length;
  const suspendedCount = agents.filter(a => a.status === "suspended").length;

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
              Agent Registry
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm sm:text-base">
              Register and govern the AI agents operating in your environment.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 text-sm font-bold bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Register Agent
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-8 sm:mb-12">
          {[
            { label: "Total Agents", value: agents.length, icon: <Bot className="w-5 h-5" /> },
            { label: "Active", value: activeCount, icon: <Shield className="w-5 h-5 text-emerald-500" /> },
            { label: "Suspended", value: suspendedCount, icon: <PauseCircle className="w-5 h-5 text-amber-500" /> },
          ].map(stat => (
            <div key={stat.label} className="p-4 sm:p-6 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-xl">
              <div className="flex items-center gap-2 mb-2 text-zinc-500 dark:text-zinc-400">
                {stat.icon}
                <span className="text-xs font-bold uppercase tracking-widest">{stat.label}</span>
              </div>
              <p className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Agents table */}
        <div className="rounded-2xl sm:rounded-[2rem] border border-zinc-200 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-xl shadow-xl overflow-hidden">
          <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-zinc-200 dark:border-white/10 flex items-center gap-3">
            <Bot className="w-5 h-5 text-violet-500" />
            <h2 className="text-base sm:text-lg font-bold">Registered Agents</h2>
          </div>

          {error && <div className="px-6 py-4 text-sm text-red-500">{error}</div>}

          {agents.length === 0 && !error ? (
            <div className="px-6 py-16 text-center">
              <Bot className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-500 text-sm mb-4">No agents registered yet.</p>
              <button
                onClick={() => setShowCreate(true)}
                className="px-4 py-2 text-sm font-bold bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all"
              >
                Register your first agent
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[640px]">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-white/5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    <th className="px-4 sm:px-8 py-3 sm:py-4">Name</th>
                    <th className="px-4 sm:px-8 py-3 sm:py-4">Type</th>
                    <th className="px-4 sm:px-8 py-3 sm:py-4">Status</th>
                    <th className="px-4 sm:px-8 py-3 sm:py-4">Scopes</th>
                    <th className="px-4 sm:px-8 py-3 sm:py-4">Last Seen</th>
                    <th className="px-4 sm:px-8 py-3 sm:py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                  {agents.map(agent => (
                    <tr key={agent.id} className="group hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 sm:px-8 py-4 sm:py-5">
                        <div>
                          <p className="font-semibold text-sm">{agent.name}</p>
                          {agent.description && (
                            <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-[180px]">{agent.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 sm:px-8 py-4 sm:py-5">
                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-white/5 px-2.5 py-1 rounded-full">
                          {TYPE_LABELS[agent.agentType] ?? agent.agentType}
                        </span>
                      </td>
                      <td className="px-4 sm:px-8 py-4 sm:py-5">
                        <StatusBadge status={agent.status} />
                      </td>
                      <td className="px-4 sm:px-8 py-4 sm:py-5">
                        <div className="flex flex-wrap gap-1">
                          {agent.scopes.length === 0
                            ? <span className="text-xs text-zinc-400">—</span>
                            : agent.scopes.slice(0, 3).map(sc => (
                                <span key={sc} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 font-mono">
                                  <Tag className="w-2.5 h-2.5" />{sc}
                                </span>
                              ))
                          }
                          {agent.scopes.length > 3 && (
                            <span className="text-[10px] text-zinc-400">+{agent.scopes.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 sm:px-8 py-4 sm:py-5 text-sm text-zinc-500">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {formatAgo(agent.lastSeenAt ?? agent.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 sm:px-8 py-4 sm:py-5 text-right">
                        {agent.status === "active" && (
                          <div className="relative inline-block">
                            <button
                              onClick={() => setOpenMenuId(openMenuId === agent.id ? null : agent.id)}
                              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 transition-all flex items-center gap-1"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            {openMenuId === agent.id && (
                              <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl shadow-lg z-20 overflow-hidden">
                                <button
                                  onClick={() => { setOpenMenuId(null); setActionId(agent.id); setActionType("suspend"); }}
                                  className="w-full text-left px-4 py-2.5 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/10 flex items-center gap-2 transition-colors"
                                >
                                  <PauseCircle className="w-4 h-4" /> Suspend
                                </button>
                                <button
                                  onClick={() => { setOpenMenuId(null); setActionId(agent.id); setActionType("revoke"); }}
                                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-2 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" /> Revoke
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-6 z-[100]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white dark:bg-zinc-900 rounded-t-[2rem] sm:rounded-[2rem] w-full sm:max-w-lg p-6 sm:p-8 shadow-2xl border border-zinc-200 dark:border-white/10 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-6">Register Agent</h3>
            {createError && <p className="text-sm text-red-500 mb-4">{createError}</p>}
            <div className="space-y-4">
              {[
                { label: "Name *", key: "name", placeholder: "e.g. billing-agent-prod", type: "text" },
                { label: "Description", key: "description", placeholder: "What does this agent do?", type: "text" },
                { label: "Owner Email", key: "ownerEmail", placeholder: "team@company.com", type: "email" },
                { label: "Scopes (comma-separated)", key: "scopes", placeholder: "payments:read, reports:write", type: "text" },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">{field.label}</label>
                  <input
                    type={field.type}
                    value={form[field.key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 transition-all"
                  />
                </div>
              ))}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Agent Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["autonomous", "assistant", "workflow"] as AgentType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setForm(f => ({ ...f, agentType: t }))}
                      className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                        form.agentType === t
                          ? "bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] border-transparent"
                          : "border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/5"
                      }`}
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-3 border border-zinc-200 dark:border-white/10 rounded-xl font-bold text-sm hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!form.name.trim() || creating}
                className="flex-1 py-3 bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] rounded-xl font-bold text-sm hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 active:scale-95 transition-all"
              >
                {creating ? "Registering…" : "Register"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm action modal */}
      {actionId && actionType && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-[100]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setActionId(null); setActionType(null); }} />
          <div className="relative bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm p-6 sm:p-8 shadow-2xl border border-zinc-200 dark:border-white/10">
            <h3 className="text-lg font-bold mb-2">
              {actionType === "revoke" ? "Revoke Agent?" : "Suspend Agent?"}
            </h3>
            <p className="text-sm text-zinc-500 mb-6">
              {actionType === "revoke"
                ? "This agent will be permanently revoked. All associated tokens will stop working immediately."
                : "This agent will be suspended and cannot take actions until reactivated."}
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setActionId(null); setActionType(null); }} className="flex-1 py-3 border border-zinc-200 dark:border-white/10 rounded-xl font-bold text-sm">Cancel</button>
              <button
                onClick={handleAction}
                disabled={actioning}
                className={`flex-1 py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50 transition-colors ${actionType === "revoke" ? "bg-red-500 hover:bg-red-600" : "bg-amber-500 hover:bg-amber-600"}`}
              >
                {actioning ? "…" : actionType === "revoke" ? "Revoke" : "Suspend"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close menus on outside click */}
      {openMenuId && <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />}
    </div>
  );
}
