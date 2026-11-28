import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, endSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  // End the session on the server, not just in this browser: a copy of the
  // cookie stops working too.
  try {
    await endSession(req.cookies.get(SESSION_COOKIE)?.value);
  } catch (err) {
    console.error("[auth/logout] endSession failed", err);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
