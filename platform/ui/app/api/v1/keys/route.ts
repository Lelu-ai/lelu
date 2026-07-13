import { NextRequest, NextResponse } from "next/server";
import { resolveUserId } from "@/lib/request-auth";
import { createApiKey, listApiKeys } from "@/lib/apikeys";

// Programmatic key management. Keys always belong to a user account; the
// acting user is resolved from either a dashboard session cookie or an
// existing `Authorization: Bearer lelu_sk_…` key — so server code can mint
// additional keys without going through the dashboard UI.

export async function GET(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const keys = await listApiKeys(userId);
    return NextResponse.json({ keys });
  } catch (err) {
    console.error("[v1/keys/GET]", err);
    return NextResponse.json({ error: "Failed to fetch keys" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, expiresInDays } = (body as Record<string, unknown>) ?? {};
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Key name is required" }, { status: 400 });
  }
  if (name.length > 64) {
    return NextResponse.json({ error: "Key name must be 64 characters or less" }, { status: 400 });
  }
  if (
    expiresInDays !== undefined &&
    (typeof expiresInDays !== "number" || !Number.isFinite(expiresInDays) || expiresInDays <= 0)
  ) {
    return NextResponse.json({ error: "expiresInDays must be a positive number" }, { status: 400 });
  }

  try {
    const result = await createApiKey(userId, name.trim(), expiresInDays as number | undefined);
    return NextResponse.json({ key: result.key, fullKey: result.fullKey }, { status: 201 });
  } catch (err) {
    console.error("[v1/keys/POST]", err);
    return NextResponse.json({ error: "Failed to create key" }, { status: 500 });
  }
}
