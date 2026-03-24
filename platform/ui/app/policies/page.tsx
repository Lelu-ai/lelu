"use client";

import { useState } from "react";
import Link from "next/link";

export default function PoliciesPage() {
  const [isEditing, setIsEditing] = useState(false);
  const [policyContent, setPolicyContent] = useState(`package lelu.auth

import future.keywords.in

# Default deny
default allow = false
default require_approval = false

# ---------------------------------------------------------
# High Confidence: Auto-Approve
# ---------------------------------------------------------
allow {
    input.action == "execute_trade"
    input.confidence >= 0.95
    input.risk_level == "low"
}

allow {
    input.action == "read_data"
    input.confidence >= 0.80
}

# ---------------------------------------------------------
# Medium Confidence: Require Human Approval
# ---------------------------------------------------------
require_approval {
    input.action == "execute_trade"
    input.confidence < 0.95
    input.confidence >= 0.70
}

require_approval {
    input.action == "execute_trade"
    input.risk_level == "high"
}

# ---------------------------------------------------------
# Low Confidence: Auto-Deny (Implicit via default)
# ---------------------------------------------------------`);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveMessage(null);
    
    try {
      const response = await fetch('/api/v1/policies/auth', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: policyContent,
          version: '1.0',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to save policy: ${response.statusText}`);
      }

      setSaveMessage({ type: 'success', text: 'Policy saved successfully!' });
      setIsEditing(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error: any) {
      setSaveMessage({ type: 'error', text: error.message || 'Failed to save policy' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="mb-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">Active Policies</h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              Manage your confidence-aware authorization rules. Policies are written in Rego and evaluated by the Lelu Engine.
            </p>
          </div>
          <Link
            href="/policies/safety"
            className="px-4 py-2 rounded-lg bg-blue-600 dark:bg-blue-500 text-white text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-all flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a10 10 0 1 0 10 10H12V2z"/>
              <path d="M12 2v10l8.66 5"/>
            </svg>
            Policy Safety Flow
          </Link>
        </div>
      </div>

      {saveMessage && (
        <div className={`mb-6 p-4 rounded-xl border ${
          saveMessage.type === 'success'
            ? 'bg-green-50 dark:bg-green-500/5 border-green-200 dark:border-green-500/20 text-green-800 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20 text-red-800 dark:text-red-300'
        }`}>
          {saveMessage.text}
        </div>
      )}

      <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
        {/* Editor Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-white/10 bg-white dark:bg-black">
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 font-mono bg-zinc-100 dark:bg-white/5 px-3 py-1 rounded-md">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              auth.rego
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-400/10 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              Deployed
            </span>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm font-medium text-zinc-900 dark:text-white bg-zinc-200 dark:bg-white/10 hover:bg-zinc-300 dark:hover:bg-white/20 px-3 py-1.5 rounded-md transition-colors"
              >
                Edit Policy
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setSaveMessage(null);
                  }}
                  className="text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-3 py-1.5 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" opacity="0.25" />
                        <path d="M4 12a8 8 0 018-8" opacity="0.75" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    'Save Policy'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Editor Content */}
        <div className="p-6 font-mono text-sm overflow-x-auto bg-white dark:bg-black">
          {isEditing ? (
            <textarea
              value={policyContent}
              onChange={(e) => setPolicyContent(e.target.value)}
              className="w-full h-96 p-4 font-mono text-sm bg-white dark:bg-black text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
              spellCheck={false}
            />
          ) : (
            <pre className="text-zinc-800 dark:text-zinc-300 leading-relaxed">
              <code>
<span className="text-zinc-500 dark:text-zinc-500">package</span> <span className="text-blue-600 dark:text-blue-400">lelu.auth</span>

<span className="text-zinc-500 dark:text-zinc-500">import</span> <span className="text-blue-600 dark:text-blue-400">future.keywords.in</span>

<span className="text-zinc-500 dark:text-zinc-500"># Default deny</span>
<span className="text-pink-600 dark:text-pink-400">default</span> allow = <span className="text-orange-600 dark:text-orange-400">false</span>
<span className="text-pink-600 dark:text-pink-400">default</span> require_approval = <span className="text-orange-600 dark:text-orange-400">false</span>

<span className="text-zinc-500 dark:text-zinc-500"># ---------------------------------------------------------</span>
<span className="text-zinc-500 dark:text-zinc-500"># High Confidence: Auto-Approve</span>
<span className="text-zinc-500 dark:text-zinc-500"># ---------------------------------------------------------</span>
<span className="text-pink-600 dark:text-pink-400">allow</span> {"{"}
    input.action == <span className="text-green-600 dark:text-green-400">"execute_trade"</span>
    input.confidence {">="} <span className="text-orange-600 dark:text-orange-400">0.95</span>
    input.risk_level == <span className="text-green-600 dark:text-green-400">"low"</span>
{"}"}

<span className="text-pink-600 dark:text-pink-400">allow</span> {"{"}
    input.action == <span className="text-green-600 dark:text-green-400">"read_data"</span>
    input.confidence {">="} <span className="text-orange-600 dark:text-orange-400">0.80</span>
{"}"}

<span className="text-zinc-500 dark:text-zinc-500"># ---------------------------------------------------------</span>
<span className="text-zinc-500 dark:text-zinc-500"># Medium Confidence: Require Human Approval</span>
<span className="text-zinc-500 dark:text-zinc-500"># ---------------------------------------------------------</span>
<span className="text-pink-600 dark:text-pink-400">require_approval</span> {"{"}
    input.action == <span className="text-green-600 dark:text-green-400">"execute_trade"</span>
    input.confidence {"<"} <span className="text-orange-600 dark:text-orange-400">0.95</span>
    input.confidence {">="} <span className="text-orange-600 dark:text-orange-400">0.70</span>
{"}"}

<span className="text-pink-600 dark:text-pink-400">require_approval</span> {"{"}
    input.action == <span className="text-green-600 dark:text-green-400">"execute_trade"</span>
    input.risk_level == <span className="text-green-600 dark:text-green-400">"high"</span>
{"}"}

<span className="text-zinc-500 dark:text-zinc-500"># ---------------------------------------------------------</span>
<span className="text-zinc-500 dark:text-zinc-500"># Low Confidence: Auto-Deny (Implicit via default)</span>
<span className="text-zinc-500 dark:text-zinc-500"># ---------------------------------------------------------</span>
            </code>
          </pre>
          )}
        </div>
      </div>
    </div>
  );
}
