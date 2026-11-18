// What the pricing page and dashboard need to know before offering checkout.
// Pure (no DOM, no network) so it can be unit tested.

export interface CheckoutConfig {
  environment: "sandbox" | "production";
  clientToken: string;
  priceId: string;
  email: string;
  userId: string;
}

export type CheckoutState =
  | { status: "ready"; config: CheckoutConfig }
  | { status: "signed_out" } // no session: send the visitor to sign in first
  | { status: "unconfigured" } // the server has no Paddle settings: checkout is not open yet
  | { status: "error" }; // anything unexpected: do not guess, let the visitor retry

// Classifies the answer of GET /api/billing/paddle/config.
export function classifyConfigResponse(httpStatus: number, body: unknown): CheckoutState {
  if (httpStatus === 401) return { status: "signed_out" };
  if (httpStatus === 503) return { status: "unconfigured" };
  if (httpStatus !== 200 || !body || typeof body !== "object") return { status: "error" };

  const b = body as Record<string, unknown>;
  const environment = b.environment === "production" ? "production" : b.environment === "sandbox" ? "sandbox" : null;
  const { clientToken, priceId, email, userId } = b;
  if (
    !environment ||
    typeof clientToken !== "string" || !clientToken ||
    typeof priceId !== "string" || !priceId ||
    typeof email !== "string" ||
    typeof userId !== "string" || !userId
  ) {
    return { status: "error" };
  }
  return { status: "ready", config: { environment, clientToken, priceId, email, userId } };
}

// Where a signed-out visitor goes to sign in and come back to the pricing page
// with checkout opening by itself.
export const UPGRADE_RETURN_PATH = "/pricing?upgrade=1";
export function loginUrlForUpgrade(): string {
  return `/login?next=${encodeURIComponent(UPGRADE_RETURN_PATH)}`;
}
