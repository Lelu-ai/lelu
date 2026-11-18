"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Shows the user's plan and monthly usage, with an Upgrade button (free users)
// or a Manage billing button (paying users). Billing is optional: if the
// server has no Paddle configuration the card still shows usage, just without
// the buttons.

interface Usage {
  plan: string;
  authRequests: number;
  authQuota: number;
  resetDate: string;
}

interface CheckoutConfig {
  environment: "sandbox" | "production";
  clientToken: string;
  priceId: string;
  email: string;
  userId: string;
}

interface PaddleEvent {
  name?: string;
}

// The small slice of Paddle.js (v2) used here.
interface PaddleGlobal {
  Environment: { set: (env: "sandbox") => void };
  Initialize: (opts: { token: string; eventCallback?: (e: PaddleEvent) => void }) => void;
  Checkout: {
    open: (opts: {
      items: { priceId: string; quantity: number }[];
      customer?: { email: string };
      customData?: Record<string, string>;
    }) => void;
  };
}

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

const PADDLE_JS = "https://cdn.paddle.com/paddle/v2/paddle.js";

function loadPaddleJs(): Promise<PaddleGlobal> {
  return new Promise((resolve, reject) => {
    if (window.Paddle) return resolve(window.Paddle);
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PADDLE_JS}"]`);
    const script = existing ?? document.createElement("script");
    const onLoad = () => (window.Paddle ? resolve(window.Paddle) : reject(new Error("Paddle.js did not load")));
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", () => reject(new Error("Could not load Paddle.js")), { once: true });
    if (!existing) {
      script.src = PADDLE_JS;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

export default function PlanCard() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [billing, setBilling] = useState<CheckoutConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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
      .then((r) => (r.ok ? (r.json() as Promise<CheckoutConfig>) : null))
      .then((c) => setBilling(c))
      .catch(() => {});
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [loadUsage]);

  // The plan changes when Paddle's webhook reaches us, a moment after the
  // payment. Poll briefly instead of asking the user to refresh.
  const waitForPaidPlan = useCallback(() => {
    setMessage("Payment received. Activating your plan…");
    let tries = 0;
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(async () => {
      tries += 1;
      const latest = await loadUsage().catch(() => null);
      if (latest?.plan === "paid") {
        if (pollTimer.current) clearInterval(pollTimer.current);
        setMessage("You're on the paid plan. Thank you!");
      } else if (tries >= 15) {
        if (pollTimer.current) clearInterval(pollTimer.current);
        setMessage("Payment received. Your plan will update shortly; refresh in a minute if it has not.");
      }
    }, 2000);
  }, [loadUsage]);

  async function upgrade() {
    if (!billing) return;
    setBusy(true);
    setMessage("");
    try {
      const paddle = await loadPaddleJs();
      if (billing.environment === "sandbox") paddle.Environment.set("sandbox");
      paddle.Initialize({
        token: billing.clientToken,
        eventCallback: (e) => {
          if (e.name === "checkout.completed") waitForPaidPlan();
        },
      });
      paddle.Checkout.open({
        items: [{ priceId: billing.priceId, quantity: 1 }],
        customer: { email: billing.email },
        // Lets the webhook find this account. See lib/billing/plan.ts for why a
        // claim made in the browser is treated carefully.
        customData: { user_id: billing.userId },
      });
    } catch {
      setMessage("Could not open the checkout. Please try again.");
    } finally {
      setBusy(false);
    }
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

  const isPaid = usage.plan === "paid";
  const pct = Math.min(100, Math.round((usage.authRequests / Math.max(1, usage.authQuota)) * 100));
  const resets = new Date(usage.resetDate).toLocaleDateString(undefined, { month: "short", day: "numeric" });

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
              {isPaid ? "Paid" : "Free"}
            </span>
          </div>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {usage.authRequests.toLocaleString()} / {usage.authQuota.toLocaleString()} authorize calls this month
            <span className="text-zinc-400"> · resets {resets}</span>
          </p>
          <div className="mt-3 h-1.5 w-full max-w-md rounded-full bg-zinc-200 dark:bg-white/10 overflow-hidden">
            <div className={`h-full rounded-full ${pct >= 90 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        {billing && (
          <button
            onClick={isPaid ? manage : upgrade}
            disabled={busy}
            className="px-4 py-2 text-xs sm:text-sm font-bold rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] hover:bg-zinc-800 dark:hover:bg-zinc-100 active:scale-95 transition-all disabled:opacity-60"
          >
            {isPaid ? "Manage billing" : "Upgrade"}
          </button>
        )}
      </div>
      {message && <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{message}</p>}
    </div>
  );
}
