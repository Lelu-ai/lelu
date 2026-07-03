import { NextRequest, NextResponse } from "next/server";
import { consumeVerificationToken, markEmailVerified } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://lelu-ai.com";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(`${BASE_URL}/login?error=invalid_token`);
  }

  try {
    const result = await consumeVerificationToken(token);

    if (!result) {
      return NextResponse.redirect(`${BASE_URL}/login?error=token_expired`);
    }

    await markEmailVerified(result.userId);
    return NextResponse.redirect(`${BASE_URL}/login?verified=1`);
  } catch (err) {
    console.error("[auth/verify-email]", err);
    return NextResponse.redirect(`${BASE_URL}/login?error=verification_failed`);
  }
}
