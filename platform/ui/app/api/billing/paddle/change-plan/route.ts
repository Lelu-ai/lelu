import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db, ensureSchema } from "@/lib/db";
import { changePlanRequest, paddleApiBase } from "@/lib/billing/paddle";
import { isUpgrade, normalizePlan, priceIdForPlan, priceIdsFromEnv, SELF_SERVE_PLANS, type SelfServePlan } from "@/lib/billing/plans";

// Switches an existing subscriber between Starter and Growth by changing the
// subscription's price, so they never end up with two subscriptions. A user
// with no subscription goes through checkout instead (the UI decides which).
//
// Upgrades are prorated and charged now; downgrades switch now and credit the
// difference on the next bill. The plan in our database changes when Paddle's
// subscription.updated webhook arrives, as for every other plan change.
export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.PADDLE_API_KEY;
  const prices = priceIdsFromEnv();
  if (!apiKey || !prices) return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { plan?: unknown } | null;
  const target = body?.plan;
  if (typeof target !== "string" || !(SELF_SERVE_PLANS as readonly string[]).includes(target)) {
    return NextResponse.json({ error: `plan must be one of: ${SELF_SERVE_PLANS.join(", ")}` }, { status: 400 });
  }
  const plan = target as SelfServePlan;
  const priceId = priceIdForPlan(plan, prices);
  if (!priceId) return NextResponse.json({ error: `The ${plan} plan is not available yet` }, { status: 503 });

  await ensureSchema();
  const sql = db();
  const rows = await sql`
    SELECT plan, billing_subscription_id
    FROM lelu_users
    WHERE id = ${session.userId} AND billing_provider = 'paddle'
  `;
  const subscriptionId = rows[0]?.billing_subscription_id as string | null | undefined;
  if (!subscriptionId) {
    return NextResponse.json({ error: "No subscription to change; start a checkout instead", code: "no_subscription" }, { status: 409 });
  }
  const current = normalizePlan(rows[0]?.plan as string | undefined);
  if (current === plan) return NextResponse.json({ plan, changed: false });

  try {
    const res = await fetch(`${paddleApiBase()}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(changePlanRequest(priceId, isUpgrade(current, plan))),
    });
    if (!res.ok) {
      console.error("[billing/paddle/change-plan] Paddle answered", res.status, await res.text().catch(() => ""));
      return NextResponse.json({ error: "Could not change the plan. Please try again." }, { status: 502 });
    }
    return NextResponse.json({ plan, changed: true });
  } catch (err) {
    console.error("[billing/paddle/change-plan]", err);
    return NextResponse.json({ error: "Could not change the plan. Please try again." }, { status: 502 });
  }
}
