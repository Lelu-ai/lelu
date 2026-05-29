"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Shield, ToggleLeft, ToggleRight, ChevronDown, ChevronRight, Edit2, Check, X } from "lucide-react";

type Decision = "allow" | "deny" | "human_review" | "compute";

interface PolicyRule {
  id: string;
  pattern: string;
  decision: Decision;
  reason: string;
}

interface Policy {
  id: string;
  name: string;
  description: string;
  rules: PolicyRule[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const DECISION_CONFIG: Record<Decision, { label: string; color: string; bg: string; dot: string }> = {
  allow: { label: "Allow", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700/40", dot: "bg-emerald-500" },
  deny: { label: "Deny", color: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/40", dot: "bg-red-500" },
  human_review: { label: "Human Review", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/40", dot: "bg-amber-500" },
  compute: { label: "Compute", color: "text-violet-700 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700/40", dot: "bg-violet-500" },
};

const DEFAULT_RULES: Omit<PolicyRule, "id">[] = [
  { pattern: "delete|drop|truncate|destroy", decision: "deny", reason: "Destructive operations are blocked." },
  { pattern: "send_email|send_message|publish|notify", decision: "human_review", reason: "Outbound communications need human sign-off." },
  { pattern: "transfer|payment|charge|refund", decision: "human_review", reason: "Financial operations require approval." },
  { pattern: "read|get|list|query|search|fetch", decision: "allow", reason: "Read-only operations are permitted." },
];

function makeRuleId() { return Math.random().toString(36).slice(2, 10); }

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newRules, setNewRules] = useState<PolicyRule[]>(
    DEFAULT_RULES.map(r => ({ ...r, id: makeRuleId() }))
  );

  // Edit state (inline, per-policy)
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Policy | null>(null);
  const [saving, setSaving] = useState(false);

  // Test state (inline, per-policy)
  const [testTool, setTestTool] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<Record<string, { decision: Decision; reason: string; rule: string } | null>>({});
  const [testing, setTesting] = useState<string | null>(null);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPolicies = useCallback(async () => {
    try {
      const res = await fetch("/api/policies");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setPolicies(data.policies);
    } catch {
      setError("Failed to load policies. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim(), rules: newRules }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error || "Failed to create"); return; }
      setPolicies(prev => [data.policy, ...prev]);
      setExpandedId(data.policy.id);
      setShowCreate(false);
      setNewName(""); setNewDesc("");
      setNewRules(DEFAULT_RULES.map(r => ({ ...r, id: makeRuleId() })));
    } catch { setCreateError("Something went wrong."); }
    finally { setCreating(false); }
  }

  async function handleToggleActive(policy: Policy) {
    const updated = { ...policy, isActive: !policy.isActive };
    setPolicies(prev => prev.map(p => p.id === policy.id ? updated : p));
    try {
      await fetch(`/api/policies/${policy.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !policy.isActive }),
      });
    } catch {
      setPolicies(prev => prev.map(p => p.id === policy.id ? policy : p)); // revert
    }
  }

  function startEdit(policy: Policy) {
    setEditingPolicyId(policy.id);
    setEditDraft({ ...policy, rules: policy.rules.map(r => ({ ...r })) });
    setExpandedId(policy.id);
  }

  async function saveEdit() {
    if (!editDraft) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/policies/${editDraft.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editDraft.name, description: editDraft.description, rules: editDraft.rules }),
      });
      const data = await res.json();
      if (!res.ok) return;
      setPolicies(prev => prev.map(p => p.id === editDraft.id ? data.policy : p));
      setEditingPolicyId(null);
      setEditDraft(null);
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await fetch(`/api/policies/${id}`, { method: "DELETE" });
      setPolicies(prev => prev.filter(p => p.id !== id));
      setDeleteId(null);
      if (expandedId === id) setExpandedId(null);
    } finally { setDeleting(false); }
  }

  async function testPolicy(policyId: string, policy: Policy) {
    const tool = (testTool[policyId] || "").trim();
    if (!tool) return;
    setTesting(policyId);
    setTestResult(prev => ({ ...prev, [policyId]: null }));
    try {
      // Evaluate locally against this policy's rules (instant, no network needed)
      let matched = false;
      for (const rule of policy.rules) {
        try {
          if (new RegExp(rule.pattern, "i").test(tool)) {
            setTestResult(prev => ({
              ...prev,
              [policyId]: { decision: rule.decision, reason: rule.reason, rule: `rule:${rule.id}` },
            }));
            matched = true;
            break;
          }
        } catch { /* invalid regex */ }
      }
      if (!matched) {
        setTestResult(prev => ({
          ...prev,
          [policyId]: { decision: "allow", reason: "No rule matched — default allow.", rule: "default-fallthrough" },
        }));
      }
    } finally { setTesting(null); }
  }

  // Rule editor helpers for both create modal and edit draft
  function addRule(
    rules: PolicyRule[],
    setRules: (r: PolicyRule[]) => void
  ) {
    setRules([...rules, { id: makeRuleId(), pattern: "", decision: "allow", reason: "" }]);
  }
  function updateRule(
    rules: PolicyRule[],
    setRules: (r: PolicyRule[]) => void,
    id: string,
    field: keyof PolicyRule,
    value: string
  ) {
    setRules(rules.map(r => r.id === id ? { ...r, [field]: value } : r));
  }
  function removeRule(
    rules: PolicyRule[],
    setRules: (r: PolicyRule[]) => void,
    id: string
  ) {
    setRules(rules.filter(r => r.id !== id));
  }

  const inputCls = "w-full h-9 px-3 rounded-lg border border-[#E7E5E4] dark:border-[#2A2A2C] bg-white dark:bg-[#18181B] text-[#0A0A0A] dark:text-white text-[13px] placeholder:text-[#A3A3A3] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/10 dark:focus:ring-white/10 focus:border-[#0A0A0A] dark:focus:border-white/20 transition-all";

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-8 w-8 border-2 border-[#0A0A0A] dark:border-white border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.03em] text-[#0A0A0A] dark:text-white mb-1">Policies</h1>
          <p className="text-[14px] text-[#737373]">
            Rules that control what your agents can do. Evaluated top-to-bottom — first match wins.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] text-[13px] font-semibold rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Policy
        </button>
      </div>

      {error && <p className="text-sm text-red-500 mb-6">{error}</p>}

      {/* How it works banner */}
      <div className="mb-6 bg-[#F4F4F5] dark:bg-[#111113] border border-[#E7E5E4] dark:border-[#222224] rounded-xl px-4 py-3 flex items-start gap-3">
        <Shield className="w-4 h-4 text-[#737373] shrink-0 mt-0.5" />
        <p className="text-[12px] text-[#737373] leading-relaxed">
          Active policies are applied to your real API key requests at <code className="font-mono bg-[#E7E5E4] dark:bg-[#1C1C1E] px-1 py-0.5 rounded">POST /api/v1/authorize</code>.
          Each rule has a pattern (matched against the tool name) and a decision.
          The first matching rule wins. If no rule matches, the request is allowed.
        </p>
      </div>

      {/* Empty state */}
      {policies.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-[#111113] border border-[#E7E5E4] dark:border-[#222224] rounded-2xl">
          <div className="w-12 h-12 rounded-full bg-[#F4F4F5] dark:bg-[#27272A] flex items-center justify-center mx-auto mb-4">
            <Shield className="w-5 h-5 text-[#A3A3A3]" />
          </div>
          <p className="text-[14px] font-medium text-[#0A0A0A] dark:text-white mb-1">No policies yet</p>
          <p className="text-[13px] text-[#737373] mb-5">Create your first policy to start controlling agent authorization.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] text-[13px] font-semibold rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
          >
            Create policy
          </button>
        </div>
      )}

      {/* Policy list */}
      <div className="space-y-3">
        {policies.map(policy => {
          const isExpanded = expandedId === policy.id;
          const isEditing = editingPolicyId === policy.id;
          const draft = isEditing ? editDraft! : policy;
          const result = testResult[policy.id];

          return (
            <div key={policy.id} className="bg-white dark:bg-[#111113] border border-[#E7E5E4] dark:border-[#222224] rounded-2xl overflow-hidden">
              {/* Policy header */}
              <div className="flex items-center gap-3 px-5 py-4">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : policy.id)}
                  className="shrink-0 text-[#A3A3A3] hover:text-[#0A0A0A] dark:hover:text-white transition-colors"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <input
                      value={draft.name}
                      onChange={e => setEditDraft(d => d ? { ...d, name: e.target.value } : d)}
                      className={inputCls + " h-8 text-[14px] font-semibold"}
                    />
                  ) : (
                    <p className="text-[14px] font-semibold text-[#0A0A0A] dark:text-white truncate">{policy.name}</p>
                  )}
                  {policy.description && !isEditing && (
                    <p className="text-[12px] text-[#737373] truncate mt-0.5">{policy.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-[#A3A3A3] hidden sm:inline">{policy.rules.length} rule{policy.rules.length !== 1 ? "s" : ""}</span>

                  {/* Active toggle */}
                  <button
                    onClick={() => handleToggleActive(policy)}
                    className={`transition-colors ${policy.isActive ? "text-emerald-500" : "text-[#A3A3A3] hover:text-[#737373]"}`}
                    title={policy.isActive ? "Active — click to deactivate" : "Inactive — click to activate"}
                  >
                    {policy.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>

                  {isEditing ? (
                    <>
                      <button onClick={() => { setEditingPolicyId(null); setEditDraft(null); }} className="p-1.5 text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white"><X className="w-4 h-4" /></button>
                      <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] text-[12px] font-semibold rounded-lg disabled:opacity-50">
                        {saving ? "Saving…" : <><Check className="w-3 h-3" />Save</>}
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(policy)} className="p-1.5 text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeleteId(policy.id)} className="p-1.5 text-[#737373] hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </>
                  )}
                </div>
              </div>

              {/* Expanded body */}
              {isExpanded && (
                <div className="border-t border-[#E7E5E4] dark:border-[#222224] px-5 py-4 space-y-4">
                  {/* Description edit */}
                  {isEditing && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#737373] uppercase tracking-widest">Description</label>
                      <input
                        value={draft.description}
                        onChange={e => setEditDraft(d => d ? { ...d, description: e.target.value } : d)}
                        placeholder="What does this policy do?"
                        className={inputCls}
                      />
                    </div>
                  )}

                  {/* Rules */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-[#737373]">Rules</span>
                      {isEditing && (
                        <button
                          onClick={() => addRule(draft.rules, rules => setEditDraft(d => d ? { ...d, rules } : d))}
                          className="flex items-center gap-1 text-[11px] font-semibold text-[#0A0A0A] dark:text-white hover:text-[#737373] transition-colors"
                        >
                          <Plus className="w-3 h-3" /> Add rule
                        </button>
                      )}
                    </div>

                    {draft.rules.length === 0 && (
                      <p className="text-[12px] text-[#A3A3A3] italic">No rules — all requests default to allow.</p>
                    )}

                    <div className="space-y-2">
                      {draft.rules.map((rule, idx) => {
                        const dcfg = DECISION_CONFIG[rule.decision];
                        return (
                          <div key={rule.id} className={`rounded-xl border p-3 ${dcfg.bg}`}>
                            {isEditing ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-[#737373] uppercase tracking-widest w-6 shrink-0">{idx + 1}</span>
                                  <input
                                    value={rule.pattern}
                                    onChange={e => updateRule(draft.rules, rules => setEditDraft(d => d ? { ...d, rules } : d), rule.id, "pattern", e.target.value)}
                                    placeholder="Pattern (e.g. delete|drop)"
                                    className="flex-1 h-8 px-2.5 rounded-lg border border-[#E7E5E4] dark:border-[#2A2A2C] bg-white dark:bg-[#18181B] text-[#0A0A0A] dark:text-white font-mono text-[12px] placeholder:text-[#A3A3A3] focus:outline-none focus:ring-1 focus:ring-[#0A0A0A]/10"
                                  />
                                  <select
                                    value={rule.decision}
                                    onChange={e => updateRule(draft.rules, rules => setEditDraft(d => d ? { ...d, rules } : d), rule.id, "decision", e.target.value)}
                                    className="h-8 px-2 rounded-lg border border-[#E7E5E4] dark:border-[#2A2A2C] bg-white dark:bg-[#18181B] text-[12px] text-[#0A0A0A] dark:text-white focus:outline-none"
                                  >
                                    <option value="allow">Allow</option>
                                    <option value="deny">Deny</option>
                                    <option value="human_review">Human Review</option>
                                    <option value="compute">Compute</option>
                                  </select>
                                  <button onClick={() => removeRule(draft.rules, rules => setEditDraft(d => d ? { ...d, rules } : d), rule.id)} className="text-[#A3A3A3] hover:text-red-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
                                </div>
                                <input
                                  value={rule.reason}
                                  onChange={e => updateRule(draft.rules, rules => setEditDraft(d => d ? { ...d, rules } : d), rule.id, "reason", e.target.value)}
                                  placeholder="Reason shown in the API response"
                                  className="w-full h-8 px-2.5 rounded-lg border border-[#E7E5E4] dark:border-[#2A2A2C] bg-white dark:bg-[#18181B] text-[#0A0A0A] dark:text-white text-[12px] placeholder:text-[#A3A3A3] focus:outline-none focus:ring-1 focus:ring-[#0A0A0A]/10"
                                />
                              </div>
                            ) : (
                              <div className="flex items-start gap-3">
                                <span className="text-[10px] font-bold text-[#A3A3A3] w-4 shrink-0 mt-0.5">{idx + 1}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <code className="text-[11px] font-mono text-[#0A0A0A] dark:text-white bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">{rule.pattern}</code>
                                    <span className="text-[#A3A3A3] text-[11px]">→</span>
                                    <span className={`text-[11px] font-bold ${dcfg.color}`}>{dcfg.label.toUpperCase()}</span>
                                  </div>
                                  {rule.reason && <p className="text-[11px] text-[#737373] mt-0.5">{rule.reason}</p>}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Test this policy */}
                  {!isEditing && (
                    <div className="pt-2 border-t border-[#F4F4F5] dark:border-[#1C1C1E]">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-[#737373] mb-2">Test this policy</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={testTool[policy.id] || ""}
                          onChange={e => setTestTool(prev => ({ ...prev, [policy.id]: e.target.value }))}
                          onKeyDown={e => e.key === "Enter" && testPolicy(policy.id, policy)}
                          placeholder="Enter a tool name (e.g. delete_records)"
                          className={inputCls + " flex-1"}
                        />
                        <button
                          onClick={() => testPolicy(policy.id, policy)}
                          disabled={testing === policy.id || !testTool[policy.id]?.trim()}
                          className="px-4 py-2 bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] text-[12px] font-semibold rounded-lg disabled:opacity-50 transition-colors shrink-0"
                        >
                          {testing === policy.id ? "…" : "Test"}
                        </button>
                      </div>
                      {result && (
                        <div className={`mt-2 rounded-xl border px-3 py-2.5 flex items-start gap-3 ${DECISION_CONFIG[result.decision].bg}`}>
                          <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${DECISION_CONFIG[result.decision].dot}`} />
                          <div>
                            <span className={`text-[12px] font-bold ${DECISION_CONFIG[result.decision].color}`}>{DECISION_CONFIG[result.decision].label.toUpperCase()}</span>
                            <p className="text-[11px] text-[#737373] mt-0.5">{result.reason}</p>
                            <code className="text-[10px] text-[#A3A3A3] font-mono">{result.rule}</code>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create Policy Modal */}
      {showCreate && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-[100]">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white dark:bg-[#111113] border border-[#E7E5E4] dark:border-[#222224] rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E7E5E4] dark:border-[#222224]">
              <h2 className="text-[16px] font-bold text-[#0A0A0A] dark:text-white">New Policy</h2>
              <button onClick={() => setShowCreate(false)} className="text-[#A3A3A3] hover:text-[#0A0A0A] dark:hover:text-white"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {createError && <p className="text-[13px] text-red-500">{createError}</p>}

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[#737373] uppercase tracking-widest">Name <span className="text-red-400">*</span></label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Production Safety Policy" className={inputCls} autoFocus />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[#737373] uppercase tracking-widest">Description</label>
                <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional description" className={inputCls} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-[#737373] uppercase tracking-widest">Rules</label>
                  <button
                    onClick={() => addRule(newRules, setNewRules)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-[#0A0A0A] dark:text-white hover:text-[#737373]"
                  >
                    <Plus className="w-3 h-3" /> Add rule
                  </button>
                </div>

                <div className="space-y-2">
                  {newRules.map((rule, idx) => (
                    <div key={rule.id} className="bg-[#F9F9F9] dark:bg-[#18181B] rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-[#A3A3A3] w-5 shrink-0">{idx + 1}</span>
                        <input
                          value={rule.pattern}
                          onChange={e => updateRule(newRules, setNewRules, rule.id, "pattern", e.target.value)}
                          placeholder="Pattern (e.g. delete|drop|truncate)"
                          className="flex-1 h-8 px-2.5 rounded-lg border border-[#E7E5E4] dark:border-[#2A2A2C] bg-white dark:bg-[#0F0F10] text-[#0A0A0A] dark:text-white font-mono text-[12px] placeholder:text-[#A3A3A3] focus:outline-none focus:ring-1 focus:ring-[#0A0A0A]/10"
                        />
                        <select
                          value={rule.decision}
                          onChange={e => updateRule(newRules, setNewRules, rule.id, "decision", e.target.value)}
                          className="h-8 px-2 rounded-lg border border-[#E7E5E4] dark:border-[#2A2A2C] bg-white dark:bg-[#0F0F10] text-[12px] text-[#0A0A0A] dark:text-white focus:outline-none"
                        >
                          <option value="allow">Allow</option>
                          <option value="deny">Deny</option>
                          <option value="human_review">Human Review</option>
                        </select>
                        <button onClick={() => removeRule(newRules, setNewRules, rule.id)} className="text-[#A3A3A3] hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                      </div>
                      <input
                        value={rule.reason}
                        onChange={e => updateRule(newRules, setNewRules, rule.id, "reason", e.target.value)}
                        placeholder="Reason shown in the API response"
                        className="w-full h-8 px-2.5 rounded-lg border border-[#E7E5E4] dark:border-[#2A2A2C] bg-white dark:bg-[#0F0F10] text-[#0A0A0A] dark:text-white text-[12px] placeholder:text-[#A3A3A3] focus:outline-none focus:ring-1 focus:ring-[#0A0A0A]/10"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#E7E5E4] dark:border-[#222224] flex gap-3 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-[13px] font-medium text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white transition-colors">Cancel</button>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="px-5 py-2 bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] text-[13px] font-semibold rounded-lg disabled:opacity-50 transition-colors"
              >
                {creating ? "Creating…" : "Create Policy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-[100]">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white dark:bg-[#111113] border border-[#E7E5E4] dark:border-[#222224] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-[16px] font-bold text-[#0A0A0A] dark:text-white mb-2">Delete Policy?</h3>
            <p className="text-[13px] text-[#737373] mb-6">This cannot be undone. The policy will stop affecting authorization immediately.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-[#E7E5E4] dark:border-[#222224] rounded-xl text-[13px] font-medium hover:bg-[#F4F4F5] dark:hover:bg-[#1C1C1E] transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} disabled={deleting} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-[13px] font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
