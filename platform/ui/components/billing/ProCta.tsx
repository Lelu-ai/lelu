"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { classifyConfigResponse, loginUrlForUpgrade, type CheckoutState } from "@/lib/billing/checkout-state";
import { openProCheckout, waitForPaidPlan } from "./paddle-client";

// The Pro tier's button on /pricing. It does what the label says:
//   signed in + billing configured -> opens Paddle's checkout right here
//   signed out                     -> sign in, then come back and open checkout
//   billing not configured         -> says so, instead of linking to a dead end
// When the visitor returns with ?upgrade=1 (after signing in), checkout opens
// by itself, once.

const BUTTON =
  "mt-6 rounded-md bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6] px-4 py-2.5 text-center text-[13.5px] font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-60";

export default function ProCta({ label }: { label: string }) {
  const [state, setState] = useState<CheckoutState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const autoOpened = useRef(false);

  const start = useCallback(async (s: Extract<CheckoutState, { status: "ready" }>) => {
    setBusy(true);
    setMessage("");
    try {
      await openProCheckout(s.config, async () => {
        setMessage("Payment received. Activating your plan…");
        await waitForPaidPlan();
        // Even if the plan has not flipped yet, the dashboard is where it will show.
        window.location.assign("/dashboard?upgraded=1");
      });
    } catch {
      setMessage("Could not open the checkout. Please try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/billing/paddle/config")
      .then(async (r) => classifyConfigResponse(r.status, await r.json().catch(() => null)))
      .then((s) => {
        setState(s);
        const wantsUpgrade = new URLSearchParams(window.location.search).get("upgrade") === "1";
        if (s.status === "ready" && wantsUpgrade && !autoOpened.current) {
          autoOpened.current = true;
          void start(s);
        }
      })
      .catch(() => setState({ status: "error" }));
  }, [start]);

  function onClick() {
    if (!state) return;
    if (state.status === "signed_out") {
      window.location.assign(loginUrlForUpgrade());
    } else if (state.status === "ready") {
      void start(state);
    } else if (state.status === "unconfigured") {
      setMessage("Pro checkout is not open yet. Join the discussion and we will let you know when it is.");
    } else {
      setMessage("Could not check billing right now. Please reload and try again.");
    }
  }

  return (
    <>
      <button type="button" onClick={onClick} disabled={busy || state === null} className={BUTTON}>
        {busy ? "Opening checkout…" : label}
      </button>
      {message && (
        <p className="mt-2 text-center text-[12px] text-[#737373] dark:text-[#8B8D98]">
          {message}
          {state?.status === "unconfigured" && (
            <>
              {" "}
              <a
                href="https://github.com/lelu-ai/lelu/discussions"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Discussions
              </a>
            </>
          )}
        </p>
      )}
    </>
  );
}
