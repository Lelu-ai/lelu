import type { CheckoutConfig } from "@/lib/billing/checkout-state";

// Browser-side Paddle.js (v2) loading and checkout, shared by the pricing page
// and the dashboard plan card.

interface PaddleEvent {
  name?: string;
}

// The small slice of Paddle.js used here.
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

export function loadPaddleJs(): Promise<PaddleGlobal> {
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

// Opens Paddle's overlay checkout for the signed-in user. `onCompleted` runs when
// the payment goes through; the plan itself only changes once Paddle's webhook
// reaches the server, so callers should poll for it (see waitForPaidPlan).
export async function openProCheckout(config: CheckoutConfig, onCompleted: () => void): Promise<void> {
  const paddle = await loadPaddleJs();
  if (config.environment === "sandbox") paddle.Environment.set("sandbox");
  paddle.Initialize({
    token: config.clientToken,
    eventCallback: (e) => {
      if (e.name === "checkout.completed") onCompleted();
    },
  });
  paddle.Checkout.open({
    items: [{ priceId: config.priceId, quantity: 1 }],
    customer: { email: config.email },
    // Lets the webhook find this account. See lib/billing/plan.ts for why a
    // claim made in the browser is treated carefully.
    customData: { user_id: config.userId },
  });
}

// Polls the usage endpoint until the plan shows as paid (the webhook is a few
// seconds behind the payment). Resolves true if it flipped, false if it did not
// within ~30 seconds.
export async function waitForPaidPlan(intervalMs = 2000, tries = 15): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const res = await fetch("/api/dashboard/usage");
      if (res.ok && ((await res.json()) as { plan?: string }).plan === "paid") return true;
    } catch {
      // keep trying
    }
  }
  return false;
}
