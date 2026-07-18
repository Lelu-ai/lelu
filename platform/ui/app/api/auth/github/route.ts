import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { buildAuthorizeUrl, providerConfigured, safeNextPath } from "@/lib/oauth";
import { cookieOptions } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://lelu-ai.com";
const STATE_COOKIE = "lelu_oauth_state";

export async function GET(req: NextRequest) {
  if (!providerConfigured("github")) {
    return NextResponse.json(
      { error: "GitHub sign-in is not configured yet. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET." },
      { status: 501 }
    );
  }

  const next = safeNextPath(req.nextUrl.searchParams.get("next"));
  const state = randomBytes(24).toString("base64url");
  const redirectUri = `${BASE_URL}/api/auth/github/callback`;

  const res = NextResponse.redirect(buildAuthorizeUrl("github", state, redirectUri));
  res.cookies.set(STATE_COOKIE, JSON.stringify({ state, next }), cookieOptions(5 * 60));
  return res;
}
