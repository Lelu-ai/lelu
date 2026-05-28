import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/apikeys";
import { listAuditEvents } from "@/lib/audit";

export async function GET(req: NextRequest) {
  // --- Auth ---
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header. Use: Bearer <api_key>" },
      { status: 401 }
    );
  }

  const apiKey = authHeader.slice(7).trim();
  const isSandbox = apiKey.startsWith("lelu_sk_sandbox_");

  let userId: string | null = null;

  if (!isSandbox) {
    const result = await validateApiKey(apiKey);
    if (!result) {
      return NextResponse.json({ error: "Invalid or revoked API key." }, { status: 401 });
    }
    userId = result.userId;
  }

  // --- Query params ---
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 500);
  const actor = searchParams.get("actor") ?? undefined;
  const action = searchParams.get("action") ?? undefined;
  const decision = searchParams.get("decision") ?? undefined;

  // --- Fetch ---
  try {
    const events = await listAuditEvents({
      userId: userId ?? undefined,
      actor,
      action,
      decision,
      limit,
    });

    return NextResponse.json({
      events,
      count: events.length,
      limit,
      cursor: 0,
      next_cursor: events.length === limit ? (events[events.length - 1]?.id ?? 0) : 0,
    });
  } catch (err) {
    console.error("[api/v1/audit]", err);
    return NextResponse.json({ error: "Failed to fetch audit events." }, { status: 500 });
  }
}
