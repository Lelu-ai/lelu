import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, createVerificationToken } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Generic success message — we never reveal whether an email is registered
// (or already verified), to avoid account-enumeration.
const GENERIC_OK = {
  ok: true,
  message: "If an unverified account exists for that email, a new verification link is on its way.",
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
    if (user && !user.emailVerified) {
      const token = await createVerificationToken(user.id);
      await sendVerificationEmail(user.email, user.name, token);
    }
  } catch (err) {
    // Log, but still return the generic response so the endpoint can't be used
    // to probe for registered emails or to detect email-delivery failures.
    console.error("[auth/resend-verification]", err);
  }

  return NextResponse.json(GENERIC_OK);
}
