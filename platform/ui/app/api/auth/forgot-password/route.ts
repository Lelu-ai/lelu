import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, createPasswordResetToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Generic success message — we never reveal whether an email is registered,
// to avoid account-enumeration.
const GENERIC_OK = {
  ok: true,
  message: "If an account exists for that email, a reset link is on its way.",
};

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { email } = (body as Record<string, unknown>) ?? {};
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  try {
    const user = await findUserByEmail(email.trim());
    if (user) {
      const token = await createPasswordResetToken(user.id);
      await sendPasswordResetEmail(user.email, user.name, token);
    }
  } catch (err) {
    // Log, but still return the generic response so the endpoint can't be used
    // to probe for registered emails or to detect email-delivery failures.
    console.error("[auth/forgot-password]", err);
  }

  return NextResponse.json(GENERIC_OK);
}
