import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db, ensureSchema } from "@/lib/db";
import { stripe, paidPriceId } from "@/lib/stripe";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://lelu-ai.com";

// Starts a Stripe Checkout session for the current user's Cloud upgrade.
// Reuses their Stripe customer if one already exists (e.g. a lapsed
// subscription) so payment history stays on one customer record.
export async function POST() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureSchema();
  const sql = db();
  const rows = await sql`SELECT stripe_customer_id FROM lelu_users WHERE id = ${session.userId}`;
  const existingCustomerId = rows[0]?.stripe_customer_id as string | null | undefined;

  try {
    const checkoutSession = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer: existingCustomerId ?? undefined,
      customer_email: existingCustomerId ? undefined : session.email,
      client_reference_id: session.userId,
      line_items: [{ price: paidPriceId(), quantity: 1 }],
      success_url: `${BASE_URL}/dashboard?upgraded=1`,
      cancel_url: `${BASE_URL}/pricing`,
      allow_promotion_codes: true,
    });

    if (!checkoutSession.url) {
      return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
    }
    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("[billing/checkout/POST]", err);
    return NextResponse.json({ error: "Failed to start checkout" }, { status: 500 });
  }
}
