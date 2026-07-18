import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, fetchProfile } from "@/lib/oauth";
import { findOrCreateOAuthUser, signJWT, SESSION_COOKIE, cookieOptions, recordLogin } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://lelu-ai.com";
const STATE_COOKIE = "lelu_oauth_state";

export async function GET(req: NextRequest) {
  const fail = (reason: string) => NextResponse.redirect(`${BASE_URL}/login?error=${reason}`);

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const stateCookie = req.cookies.get(STATE_COOKIE)?.value;

  if (!code || !state) return fail("oauth_missing_params");
  if (!stateCookie) return fail("oauth_expired");

  let saved: { state: string; next: string };
  try {
    saved = JSON.parse(stateCookie);
  } catch {
    return fail("oauth_invalid_state");
  }
  if (saved.state !== state) return fail("oauth_invalid_state");

  try {
    const redirectUri = `${BASE_URL}/api/auth/google/callback`;
    const accessToken = await exchangeCode("google", code, redirectUri);
    const profile = await fetchProfile("google", accessToken);
    const user = await findOrCreateOAuthUser("google", profile);

    try {
      await recordLogin(user.id);
    } catch (err) {
      console.error("[auth/google/callback] recordLogin failed", err);
    }

    const jwt = signJWT({
      userId: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
    });

    const res = NextResponse.redirect(`${BASE_URL}${saved.next}`);
    res.cookies.set(SESSION_COOKIE, jwt, cookieOptions(60 * 60 * 24 * 7));
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (err) {
    console.error("[auth/google/callback]", err);
    return fail("oauth_failed");
  }
}
