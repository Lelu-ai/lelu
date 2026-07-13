import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/apikeys";

// Verifies an API key and resolves its owner. Self-authenticating: the caller
// must already hold the full key, so no extra credential is needed — the
// response only confirms what the key holder could learn by using the key.
// Used by the engine to accept account-bound lelu_sk_ keys.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { key } = (body as Record<string, unknown>) ?? {};
  if (typeof key !== "string" || !key.startsWith("lelu_sk_")) {
    return NextResponse.json({ valid: false }, { status: 200 });
  }

  try {
    const result = await validateApiKey(key);
    if (!result) {
      return NextResponse.json({ valid: false }, { status: 200 });
    }
    return NextResponse.json(
      { valid: true, userId: result.userId, keyId: result.keyId },
      { status: 200 }
    );
  } catch (err) {
    console.error("[keys/verify]", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
