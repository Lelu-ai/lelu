import { getCurrentUser, isAdminEmail } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ user: null }, { status: 401 });
    }
    return NextResponse.json({
      user: {
        email: session.email,
        name: session.name,
        userId: session.userId,
        isAdmin: isAdminEmail(session.email),
      },
    });
  } catch (err) {
    console.error("[auth/me]", err);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
