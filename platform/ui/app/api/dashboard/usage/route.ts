import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkQuota } from "@/lib/quota";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const quota = await checkQuota(session.userId);

    const now = new Date();
    const resetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    return NextResponse.json({
      plan: quota.plan,
      authRequests: quota.used,
      authQuota: quota.limit,
      resetDate: resetDate.toISOString(),
    });
  } catch (error) {
    console.error("Failed to fetch usage stats:", error);
    return NextResponse.json({ error: "Failed to fetch usage stats" }, { status: 500 });
  }
}
