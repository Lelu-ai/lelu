import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runOverageBilling } from "@/lib/billing/overage";

// Bills last month's overage. Vercel Cron calls this on the 1st of each month
// (vercel.json) with `Authorization: Bearer $CRON_SECRET`. It can also be run
// by hand for a specific month with ?period=YYYY-MM; re-running never charges
// a month twice (see lib/billing/overage.ts).
export const maxDuration = 300;

function authorized(req: NextRequest, secret: string): boolean {
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorized(req, secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // The job bills the month before `now`, so ?period=2026-10 runs as if on 2026-11-01.
  let now = new Date();
  const period = req.nextUrl.searchParams.get("period");
  if (period) {
    const m = period.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
    if (!m) return NextResponse.json({ error: "period must look like 2026-10" }, { status: 400 });
    now = new Date(Date.UTC(Number(m[1]), Number(m[2]), 1));
  }

  try {
    const result = await runOverageBilling(now);
    if (!result.configured) {
      return NextResponse.json({ ...result, note: "Overage billing is off: set PADDLE_API_KEY and PADDLE_PRICE_ID_OVERAGE" });
    }
    if (result.failed.length || result.needsReview.length) console.error("[billing/overage/run]", result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[billing/overage/run]", err);
    return NextResponse.json({ error: "Overage run failed" }, { status: 500 });
  }
}
