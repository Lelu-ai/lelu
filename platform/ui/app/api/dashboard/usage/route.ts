import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkQuota } from "@/lib/quota";
import { monthRange, overageUsd, PLANS } from "@/lib/billing/plans";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const quota = await checkQuota(session.userId);
    const plan = PLANS[quota.plan];

    return NextResponse.json({
      plan: quota.plan,
      planName: plan.name,
      authRequests: quota.used,
      authQuota: quota.limit,
      // Paid plans keep running past authQuota; these say what that costs.
      overage: plan.overage,
      overageCalls: quota.overageCalls,
      overageUsd: overageUsd(quota.overageCalls),
      resetDate: monthRange(new Date()).end.toISOString(),
    });
  } catch (error) {
    console.error("Failed to fetch usage stats:", error);
    return NextResponse.json({ error: "Failed to fetch usage stats" }, { status: 500 });
  }
}
