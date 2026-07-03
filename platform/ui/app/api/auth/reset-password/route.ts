import { NextRequest, NextResponse } from "next/server";
import { consumePasswordResetToken, updateUserPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { token, password } = (body as Record<string, unknown>) ?? {};

  if (typeof token !== "string" || !token) {
    return NextResponse.json({ error: "Reset token is required" }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (password.length > 128) {
    return NextResponse.json({ error: "Password too long" }, { status: 400 });
  }

  try {
    const result = await consumePasswordResetToken(token);
    if (!result) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Please request a new one." },
        { status: 400 }
      );
    }
    await updateUserPassword(result.userId, password);
  } catch (err) {
    console.error("[auth/reset-password]", err);
    return NextResponse.json({ error: "Password reset failed. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
