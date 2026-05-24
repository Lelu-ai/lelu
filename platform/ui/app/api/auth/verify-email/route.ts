import { NextResponse } from "next/server";

// Email verification is disabled — users are verified on registration.
export async function GET() {
  return NextResponse.json(
    { error: "Email verification is not enabled." },
    { status: 410 }
  );
}
