import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db, ensureSchema } from "@/lib/db";
import { stripe } from "@/lib/stripe";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://lelu-ai.com";

// Hands the user off to Stripe's hosted portal to update their card,
// view invoices, or cancel — nothing here needs its own UI.
export async function POST() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureSchema();
  const sql = db();
  const rows = await sql`SELECT stripe_customer_id FROM lelu_users WHERE id = ${session.userId}`;
  const customerId = rows[0]?.stripe_customer_id as string | null | undefined;
  if (!customerId) {
    return NextResponse.json({ error: "No billing account found" }, { status: 404 });
  }

  try {
    const portalSession = await stripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${BASE_URL}/dashboard`,
    });
    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    console.error("[billing/portal/POST]", err);
    return NextResponse.json({ error: "Failed to open billing portal" }, { status: 500 });
  }
}
