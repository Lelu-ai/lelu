import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db, ensureSchema } from "@/lib/db";
import { paddleConfig } from "@/lib/billing/paddle";
import { normalizePlan, priceIdsFromEnv } from "@/lib/billing/plans";

// What the browser needs to open Paddle's checkout (or switch plans) for the
// signed-in user. Everything here is safe to expose: the client token and
// price ids are meant to be public. Answers 503 when billing is not
// configured, so the UI can hide the buttons.
export async function GET() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = paddleConfig(priceIdsFromEnv());
  if (!config) return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });

  await ensureSchema();
  const sql = db();
  const rows = await sql`
    SELECT plan, billing_subscription_id
    FROM lelu_users
    WHERE id = ${session.userId}
  `;

  return NextResponse.json({
    environment: config.environment,
    clientToken: config.clientToken,
    priceIds: { starter: config.prices.starter, growth: config.prices.growth },
    email: session.email,
    userId: session.userId,
    currentPlan: normalizePlan(rows[0]?.plan as string | undefined),
    // A subscriber switches plans in place; only a non-subscriber checks out.
    hasSubscription: Boolean(rows[0]?.billing_subscription_id),
  });
}
