"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  classifyConfigResponse,
  loginUrlForUpgrade,
  planAction,
  type CheckoutConfig,
  type CheckoutState,
} from "@/lib/billing/checkout-state";
import type { SelfServePlan } from "@/lib/billing/plans";
import { changePlan, openCheckout, waitForPlan } from "./paddle-client";

// A paid plan's button on /pricing. It does what the label says:
//   signed out                       -> sign in, then come back and continue
//   no subscription                  -> opens Paddle's checkout right here
//   subscribed to the other plan     -> switches the subscription in place
//   already on this plan             -> shows "Current plan"
//   billing not configured           -> says so, instead of linking to a dead end
// When the visitor returns with ?upgrade=<plan> (after signing in), that plan's
// checkout opens by itself, once.

const BUTTON =
  "mt-6 rounded-md bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6] px-4 py-2.5 text-center text-[13.5px] font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-60";
const BUTTON_QUIET =
  "mt-6 rounded-md border border-[#D6D3D1] dark:border-white/[0.12] px-4 py-2.5 text-center text-[13.5px] font-medium text-[#0A0A0A] dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors disabled:opacity-60";

const DISCUSSIONS = "https://github.com/lelu-ai/lelu/discussions";

export default function PlanCta({ plan, label, primary = true }: { plan: SelfServePlan; label: string; primary?: boolean }) {
  const [state, setState] = useState<CheckoutState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const autoOpened = useRef(false);

  const done = useCallback(async () => {
    setMessage("Payment received. Activating your plan…");
    await waitForPlan(plan);
    // Even if the plan has not switched yet, the dashboard is where it will show.
    window.location.assign(`/dashboard?upgraded=${plan}`);
  }, [plan]);

  const start = useCallback(
    async (config: CheckoutConfig) => {
      const action = planAction(config, plan);
      setMessage("");
      if (action === "current") return setMessage("You're already on this plan.");
      if (action === "contact") return setMessage("Your plan is custom. Get in touch to change it.");
      if (action === "unavailable") return setMessage("This plan is not open yet. Join the discussion and we will let you know.");
      setBusy(true);
      try {
        if (action === "change") {
          const error = await changePlan(plan);
          if (error) setMessage(error);
          else await done();
        } else {
          await openCheckout(config, plan, () => void done());
        }
      } catch {
        setMessage("Could not open the checkout. Please try again.");
      } finally {
        setBusy(false);
      }
    },
    [plan, done],
  );

  useEffect(() => {
    fetch("/api/billing/paddle/config")
      .then(async (r) => classifyConfigResponse(r.status, await r.json().catch(() => null)))
      .then((s) => {
        setState(s);
        const wanted = new URLSearchParams(window.location.search).get("upgrade");
        if (s.status === "ready" && wanted === plan && !autoOpened.current) {
          autoOpened.current = true;
          void start(s.config);
        }
      })
      .catch(() => setState({ status: "error" }));
  }, [plan, start]);

  function onClick() {
    if (!state) return;
    if (state.status === "signed_out") window.location.assign(loginUrlForUpgrade(plan));
    else if (state.status === "ready") void start(state.config);
    else if (state.status === "unconfigured") setMessage("Checkout is not open yet. Join the discussion and we will let you know when it is.");
    else setMessage("Could not check billing right now. Please reload and try again.");
  }

  const isCurrent = state?.status === "ready" && planAction(state.config, plan) === "current";
  const text = busy ? "Opening…" : isCurrent ? "Current plan" : label;

  return (
    <>
      <button type="button" onClick={onClick} disabled={busy || state === null || isCurrent} className={primary ? BUTTON : BUTTON_QUIET}>
        {text}
      </button>
      {message && (
        <p className="mt-2 text-center text-[12px] text-[#737373] dark:text-[#8B8D98]">
          {message}
          {(state?.status === "unconfigured" || message.includes("discussion") || message.includes("touch")) && (
            <>
              {" "}
              <a href={DISCUSSIONS} target="_blank" rel="noreferrer" className="underline">
                Discussions
              </a>
            </>
          )}
        </p>
      )}
    </>
  );
}
