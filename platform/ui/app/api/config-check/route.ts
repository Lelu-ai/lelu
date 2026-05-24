import { NextResponse } from "next/server";

// Diagnostic endpoint — shows which required env vars are present/missing.
// Returns only presence (true/false), never values.
export async function GET() {
  const vars = {
    DATABASE_URL: !!(process.env.DATABASE_URL ?? process.env.POSTGRES_URL),
    JWT_SECRET: !!process.env.JWT_SECRET,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    NEXT_PUBLIC_BASE_URL: !!process.env.NEXT_PUBLIC_BASE_URL,
    NODE_ENV: process.env.NODE_ENV ?? "not set",
  };

  const missing = Object.entries(vars)
    .filter(([k, v]) => k !== "NODE_ENV" && v === false)
    .map(([k]) => k);

  return NextResponse.json({
    ok: missing.length === 0,
    vars,
    missing,
    hint: missing.length > 0
      ? `Set missing vars in Vercel → Project Settings → Environment Variables, then redeploy.`
      : "All required env vars are present.",
  });
}
