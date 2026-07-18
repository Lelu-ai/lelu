// Hand-rolled OAuth 2.0 Authorization Code flow for Google + GitHub login —
// no auth library, just fetch(). Mirrors the zero-dependency style of
// lib/auth.ts (scrypt + hand-rolled JWT sessions).

export type OAuthProvider = "google" | "github";

export interface OAuthProfile {
  providerAccountId: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

interface ProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  clientId: () => string | undefined;
  clientSecret: () => string | undefined;
}

const CONFIG: Record<OAuthProvider, ProviderConfig> = {
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
  },
  github: {
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scope: "read:user user:email",
    clientId: () => process.env.GITHUB_CLIENT_ID,
    clientSecret: () => process.env.GITHUB_CLIENT_SECRET,
  },
};

// Only ever redirect to a local path after OAuth login — rejects absolute
// URLs and protocol-relative ("//evil.com") values to prevent an open redirect.
export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export function providerConfigured(provider: OAuthProvider): boolean {
  const cfg = CONFIG[provider];
  return Boolean(cfg.clientId() && cfg.clientSecret());
}

export function buildAuthorizeUrl(provider: OAuthProvider, state: string, redirectUri: string): string {
  const cfg = CONFIG[provider];
  const clientId = cfg.clientId();
  if (!clientId) throw new Error(`${provider} OAuth is not configured (missing client id)`);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: cfg.scope,
    state,
    response_type: "code",
  });
  if (provider === "google") {
    params.set("access_type", "online");
    params.set("prompt", "select_account");
  }
  return `${cfg.authorizeUrl}?${params.toString()}`;
}

export async function exchangeCode(provider: OAuthProvider, code: string, redirectUri: string): Promise<string> {
  const cfg = CONFIG[provider];
  const clientId = cfg.clientId();
  const clientSecret = cfg.clientSecret();
  if (!clientId || !clientSecret) throw new Error(`${provider} OAuth is not configured`);

  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`${provider} token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(
      `${provider} token exchange returned no access_token: ${data.error ?? ""} ${data.error_description ?? ""}`
    );
  }
  return data.access_token;
}

export async function fetchProfile(provider: OAuthProvider, accessToken: string): Promise<OAuthProfile> {
  return provider === "google" ? fetchGoogleProfile(accessToken) : fetchGitHubProfile(accessToken);
}

async function fetchGoogleProfile(accessToken: string): Promise<OAuthProfile> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google profile fetch failed: ${res.status}`);
  const data = (await res.json()) as { sub: string; email?: string; email_verified?: boolean; name?: string };
  if (!data.email) throw new Error("Google account has no email");

  return {
    providerAccountId: data.sub,
    email: data.email,
    name: data.name ?? data.email.split("@")[0],
    emailVerified: Boolean(data.email_verified),
  };
}

async function fetchGitHubProfile(accessToken: string): Promise<OAuthProfile> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "lelu-ai.com",
  };

  const res = await fetch("https://api.github.com/user", { headers });
  if (!res.ok) throw new Error(`GitHub profile fetch failed: ${res.status}`);
  const data = (await res.json()) as { id: number; email: string | null; name: string | null; login: string };

  // /user/emails is the authoritative source for verified status — the
  // profile's `email` field, even when public, doesn't indicate verification.
  let email = data.email;
  let emailVerified = false;
  const emailsRes = await fetch("https://api.github.com/user/emails", { headers });
  if (emailsRes.ok) {
    const emails = (await emailsRes.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
    const best = emails.find((e) => e.primary) ?? emails.find((e) => e.verified) ?? emails[0];
    if (best) {
      email = best.email;
      emailVerified = best.verified;
    }
  }

  if (!email) throw new Error("GitHub account has no accessible email — grant email access or make it public");

  return {
    providerAccountId: String(data.id),
    email,
    name: data.name ?? data.login,
    emailVerified,
  };
}
