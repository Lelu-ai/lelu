"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { classifyConfigResponse, type CheckoutConfig } from "@/lib/billing/checkout-state";
import { OVERAGE_BLOCK, OVERAGE_USD_PER_BLOCK } from "@/lib/billing/plans";
import { changePlan, waitForPlan } from "./paddle-client";

// Shows the user's plan and this month's usage. Free users get a link to the
// plans; Starter users can move up to Growth in place; every paying user can
// open Paddle's billing portal. Billing is optional: with no Paddle
// configuration the card still shows usage, just without the buttons.

interface Usage {
  plan: string;
  planName: string;
  authRequests: number;
  authQuota: number;
  overage: boolean;
  overageCalls: number;
  overageUsd: number;
  resetDate: string;
}

const BTN =
  "px-4 py-2 text-xs sm:text-sm font-bold rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] hover:bg-zinc-800 dark:hover:bg-zinc-100 active:scale-95 transition-all disabled:opacity-60";
const BTN_QUIET =
  "px-4 py-2 text-xs sm:text-sm font-bold rounded-lg border border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 transition-all disabled:opacity-60";

export default function PlanCard() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [billing, setBilling] = useState<CheckoutConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadUsage = useCallback(async (): Promise<Usage | null> => {
    const res = await fetch("/api/dashboard/usage");
    if (!res.ok) return null;
    const data = (await res.json()) as Usage;
    setUsage(data);
    return data;
  }, []);

  useEffect(() => {
    loadUsage().catch(() => {});
    fetch("/api/billing/paddle/config")
      .then(async (r) => classifyConfigResponse(r.status, await r.json().catch(() => null)))
      .then((state) => setBilling(state.status === "ready" ? state.config : null))
      .catch(() => {});
  }, [loadUsage]);

  async function upgradeToGrowth() {
    setBusy(true);
    setMessage("");
    const error = await changePlan("growth");
    if (error) {
      setMessage(error);
      setBusy(false);
      return;
    }
    setMessage("Switching to Growth…");
    const switched = await waitForPlan("growth");
    await loadUsage().catch(() => null);
    setMessage(switched ? "You're on Growth. Thank you!" : "Your plan will update shortly; refresh in a minute if it has not.");
    setBusy(false);
  }

  async function manage() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/billing/paddle/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (res.ok && data.url) window.location.href = data.url;
      else setMessage(data.error ?? "Could not open the billing portal.");
    } catch {
      setMessage("Could not open the billing portal.");
    } finally {
      setBusy(false);
    }
  }

  if (!usage) return null;

  const isPaid = usage.plan !== "free";
  const pct = Math.min(100, Math.round((usage.authRequests / Math.max(1, usage.authQuota)) * 100));
  const resets = new Date(usage.resetDate).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const canMoveToGrowth = usage.plan === "starter" && !!billing?.priceIds.growth && billing.hasSubscription;

  return (
    <div className="mb-8 sm:mb-10 p-4 sm:p-6 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-xl shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-zinc-500">Plan</span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${
                isPaid ? "border-emerald-500/50 text-emerald-600 dark:text-emerald-400" : "border-zinc-300 dark:border-white/15 text-zinc-500"
              }`}
            >
              {usage.planName}
            </span>
          </div>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {usage.authRequests.toLocaleString()} / {usage.authQuota.toLocaleString()} authorize calls included this month
            <span className="text-zinc-400"> · resets {resets}</span>
          </p>
          <div className="mt-3 h-1.5 w-full max-w-md rounded-full bg-zinc-200 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full ${usage.overageCalls > 0 ? "bg-sky-500" : pct >= 90 ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {usage.overage && usage.overageCalls > 0 && (
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
              {usage.overageCalls.toLocaleString()} extra calls so far: ${usage.overageUsd.toFixed(2)} at $
              {OVERAGE_USD_PER_BLOCK.toFixed(2)} per {OVERAGE_BLOCK.toLocaleString()}, added to your next invoice. Your agents keep running.
            </p>
          )}
          {!usage.overage && pct >= 90 && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
              Free stops at {usage.authQuota.toLocaleString()} calls. Starter never blocks your agents.
            </p>
          )}
        </div>
        {billing && (
          <div className="flex flex-wrap gap-2">
            {!isPaid && (
              <Link href="/pricing" className={BTN}>
                Choose a plan
              </Link>
            )}
            {canMoveToGrowth && (
              <button type="button" onClick={upgradeToGrowth} disabled={busy} className={BTN}>
                Upgrade to Growth
              </button>
            )}
            {isPaid && (
              <button type="button" onClick={manage} disabled={busy} className={BTN_QUIET}>
                Manage billing
              </button>
            )}
          </div>
        )}
      </div>
      {message && <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{message}</p>}
    </div>
  );
}
