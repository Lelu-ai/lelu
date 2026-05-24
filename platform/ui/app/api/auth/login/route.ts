import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, verifyPassword, signJWT, SESSION_COOKIE, cookieOptions } from "@/lib/auth";

// Constant-time dummy hash to prevent timing-based email enumeration
const DUMMY_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000:" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "0000000000000000000000000000000000000000000000000000000000000000";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { email, password } = (body as Record<string, unknown>) ?? {};

  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  try {
    const user = await findUserByEmail(email);

    // Always run verifyPassword to prevent timing attacks
    const valid = user
      ? verifyPassword(password, user.passwordHash)
      : verifyPassword(password, DUMMY_HASH);

    if (!user || !valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const jwt = signJWT({
      userId: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
    });

    const res = NextResponse.json({
      ok: true,
      user: { id: user.id, name: user.name, email: user.email },
    });
    res.cookies.set(SESSION_COOKIE, jwt, cookieOptions(60 * 60 * 24 * 7));
    return res;
  } catch (err) {
    console.error("[auth/login]", err);
    return NextResponse.json({ error: "Login failed. Please try again." }, { status: 500 });
  }
}
