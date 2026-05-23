import { NextResponse } from "next/server";

// Anonymous key usage stats have been removed. API keys now require a Lelu account.
export async function GET() {
  return NextResponse.json(
    { error: "This endpoint is no longer available. Sign in at lelu-ai.com and visit /api-key to manage your keys." },
    { status: 410 }
  );
}
