import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { paddleConfig } from "@/lib/billing/paddle";

// What the browser needs to open Paddle's checkout for the signed-in user.
// Everything here is safe to expose: the client token is meant to be public.
// Answers 503 when billing is not configured, so the UI can hide the button.
export async function GET() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = paddleConfig();
  if (!config) return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });

  return NextResponse.json({
    environment: config.environment,
    clientToken: config.clientToken,
    priceId: config.priceId,
    email: session.email,
    userId: session.userId,
  });
}
