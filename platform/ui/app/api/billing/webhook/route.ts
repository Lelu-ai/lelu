import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db, ensureSchema } from "@/lib/db";
import { stripe } from "@/lib/stripe";

// Stripe's source of truth for plan changes — Checkout success/cancel URLs
// are just where the browser lands, this is what actually flips `plan`.
// Keep this route's logic idempotent: Stripe retries undelivered webhooks.
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[billing/webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("[billing/webhook] signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  await ensureSchema();
  const sql = db();

  switch (event.type) {
    case "checkout.session.completed": {
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      const userId = checkoutSession.client_reference_id;
      const customerId = checkoutSession.customer as string | null;
      if (userId && customerId) {
        await sql`
          UPDATE lelu_users
          SET plan = 'paid', plan_updated_at = NOW(), stripe_customer_id = ${customerId}
          WHERE id = ${userId}
        `;
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const active = subscription.status === "active" || subscription.status === "trialing";
      await sql`
        UPDATE lelu_users
        SET plan = ${active ? "paid" : "free"}, plan_updated_at = NOW()
        WHERE stripe_customer_id = ${customerId}
      `;
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
