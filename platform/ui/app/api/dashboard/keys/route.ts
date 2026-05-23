import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createApiKey, listApiKeys } from "@/lib/apikeys";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const keys = await listApiKeys(session.userId);
    return NextResponse.json({ keys });
  } catch (err) {
    console.error("[keys/GET]", err);
    return NextResponse.json({ error: "Failed to fetch keys" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name } = (body as Record<string, unknown>) ?? {};
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Key name is required" }, { status: 400 });
  }
  if (name.length > 64) {
    return NextResponse.json({ error: "Key name must be 64 characters or less" }, { status: 400 });
  }

  try {
    const result = await createApiKey(session.userId, name.trim());
    return NextResponse.json(
      { key: result.key, fullKey: result.fullKey },
      { status: 201 }
    );
  } catch (err) {
    console.error("[keys/POST]", err);
    return NextResponse.json({ error: "Failed to create key" }, { status: 500 });
  }
}
