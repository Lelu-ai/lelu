import { NextResponse } from "next/server";

// Anonymous key generation has been removed. API keys now require a Lelu account.
// See /api-key to create a key after signing in.
export async function POST() {
  return NextResponse.json(
    { error: "Anonymous key generation is no longer available. Sign in at lelu-ai.com and visit /api-key to create a key." },
    { status: 410 }
  );
}
