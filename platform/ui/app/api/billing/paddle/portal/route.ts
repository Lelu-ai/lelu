import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db, ensureSchema } from "@/lib/db";
import { paddleApiBase } from "@/lib/billing/paddle";

// Returns a link to Paddle's customer portal, where the user can update their
// card, see invoices or cancel. Needs PADDLE_API_KEY (server-side only).
export async function POST() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });

  await ensureSchema();
  const sql = db();
  const rows = await sql`
    SELECT billing_customer_id, billing_subscription_id
    FROM lelu_users
    WHERE id = ${session.userId} AND billing_provider = 'paddle'
  `;
  const customerId = rows[0]?.billing_customer_id as string | null | undefined;
  const subscriptionId = rows[0]?.billing_subscription_id as string | null | undefined;
  if (!customerId) return NextResponse.json({ error: "No billing account for this user" }, { status: 400 });

  try {
    const res = await fetch(`${paddleApiBase()}/customers/${encodeURIComponent(customerId)}/portal-sessions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(subscriptionId ? { subscription_ids: [subscriptionId] } : {}),
    });
    if (!res.ok) {
      console.error("[billing/paddle/portal] Paddle answered", res.status);
      return NextResponse.json({ error: "Failed to open the billing portal" }, { status: 502 });
    }
    const json = (await res.json()) as { data?: { urls?: { general?: { overview?: string } } } };
    const url = json.data?.urls?.general?.overview;
    if (!url) return NextResponse.json({ error: "Failed to open the billing portal" }, { status: 502 });
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[billing/paddle/portal]", err);
    return NextResponse.json({ error: "Failed to open the billing portal" }, { status: 502 });
  }
}
