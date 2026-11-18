import { NextRequest, NextResponse } from "next/server";
import { applyPlanChange } from "@/lib/billing/plan";
import { planChangeFromEvent, verifyPaddleSignature } from "@/lib/billing/paddle";

// Paddle's source of truth for plan changes. The checkout overlay closing only
// tells the browser it finished; this route is what flips `plan`.
//
// Set the notification destination in Paddle (Developer tools > Notifications)
// to https://<your-domain>/api/billing/paddle/webhook and subscribe to the
// subscription.* events. PADDLE_WEBHOOK_SECRET is that destination's secret
// (pdl_ntfset_...), not the API key.
export async function POST(req: NextRequest) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[billing/paddle/webhook] PADDLE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // Raw text, exactly as received: the signature covers these bytes.
  const rawBody = await req.text();
  if (!verifyPaddleSignature(rawBody, req.headers.get("paddle-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Events we do not act on (transactions, customers, ...) are acknowledged so
  // Paddle does not keep retrying them.
  const change = planChangeFromEvent(body);
  if (!change) return NextResponse.json({ received: true, ignored: true });

  try {
    const updated = await applyPlanChange("paddle", change);
    if (updated === 0) {
      // Unknown user, or an older event than the one already applied. Both are
      // safe to acknowledge; the log line is for debugging a missing upgrade.
      console.warn("[billing/paddle/webhook] no user updated", {
        event: change.eventType,
        hasUserId: !!change.userId,
        customerId: change.customerId,
      });
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    // 500 makes Paddle retry, which is what we want for a transient DB error.
    console.error("[billing/paddle/webhook]", err);
    return NextResponse.json({ error: "Failed to apply plan change" }, { status: 500 });
  }
}
