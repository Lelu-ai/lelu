import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db, ensureSchema } from "./db";
import { decideOAuthLink, OAUTH_EMAIL_UNVERIFIED } from "./oauth-link";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  // Null for OAuth-only accounts (no password ever set).
  passwordHash: string | null;
  emailVerified: boolean;
  createdAt: string;
}

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  emailVerified: boolean;
  /** Random session id; the session is valid only while lelu_sessions has it. */
  sid?: string;
  iat: number;
  exp: number;
}

export const SESSION_COOKIE = "lelu_session";
export const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// ── JWT (zero-dependency, Node.js crypto) ─────────────────────────────────────

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function getSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set. Generate one with: openssl rand -base64 32");
  return s;
}

// Prefer createSession: a token signed here without a stored session id is
// rejected by getCurrentUser.
export function signJWT(payload: Omit<SessionPayload, "iat" | "exp">): string {
  const secret = getSecret();
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = b64url(
    Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + SESSION_TTL }))
  );
  const sig = b64url(createHmac("sha256", secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

export function verifyJWT(token: string): SessionPayload | null {
  try {
    const secret = getSecret();
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;

    const expectedSig = b64url(
      createHmac("sha256", secret).update(`${header}.${body}`).digest()
    );

    // Both are fixed-length HMAC-SHA256 base64url (43 chars) — safe for timingSafeEqual
    const a = Buffer.from(sig, "base64");
    const b = Buffer.from(expectedSig, "base64");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const payload = JSON.parse(Buffer.from(body, "base64").toString()) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

// ── Password hashing ──────────────────────────────────────────────────────────

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const derived = scryptSync(password, salt, 64);
    return timingSafeEqual(derived, Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

// ── User management ───────────────────────────────────────────────────────────

export async function createUser(
  name: string,
  email: string,
  password: string,
  opts: { emailVerified?: boolean } = {}
): Promise<User> {
  await ensureSchema();
  const sql = db();
  const norm = email.toLowerCase().trim();

  const existing = await sql`SELECT id FROM lelu_users WHERE email = ${norm}`;
  if (existing.length > 0) throw new Error("EMAIL_TAKEN");

  const user: User = {
    id: randomBytes(16).toString("hex"),
    name: name.trim(),
    email: norm,
    passwordHash: hashPassword(password),
    emailVerified: opts.emailVerified ?? false,
    createdAt: new Date().toISOString(),
  };

  await sql`
    INSERT INTO lelu_users (id, name, email, password_hash, email_verified, created_at)
    VALUES (${user.id}, ${user.name}, ${user.email}, ${user.passwordHash}, ${user.emailVerified}, NOW())
  `;

  return user;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  await ensureSchema();
  const sql = db();
  const rows = await sql`
    SELECT id, name, email, password_hash, email_verified, created_at
    FROM lelu_users WHERE email = ${email.toLowerCase().trim()}
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id as string,
    name: r.name as string,
    email: r.email as string,
    passwordHash: r.password_hash as string | null,
    emailVerified: r.email_verified as boolean,
    createdAt: r.created_at as string,
  };
}

// ── OAuth (Google / GitHub) ─────────────────────────────────────────────────────

export type OAuthProviderName = "google" | "github";

export interface OAuthProfileInput {
  providerAccountId: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

// Finds the user for an OAuth login, linking or creating as needed. What is
// allowed is decided by decideOAuthLink (lib/oauth-link.ts):
//   1. This (provider, provider_account_id) already linked → that user.
//   2. The provider has not verified the email → refused (throws
//      OAUTH_EMAIL_UNVERIFIED). An unverified address proves nothing about
//      who owns the matching Lelu account.
//   3. A user with this email exists → link this provider to it. If that
//      account never verified its email, its password is cleared and the
//      email marked verified, since the provider has now proved ownership.
//   4. Neither → create a new, password-less, verified user.
export async function findOrCreateOAuthUser(
  provider: OAuthProviderName,
  profile: OAuthProfileInput
): Promise<User> {
  await ensureSchema();
  const sql = db();
  const norm = profile.email.toLowerCase().trim();

  const linked = await sql`
    SELECT u.id, u.name, u.email, u.password_hash, u.email_verified, u.created_at
    FROM lelu_oauth_accounts o
    JOIN lelu_users u ON u.id = o.user_id
    WHERE o.provider = ${provider} AND o.provider_account_id = ${profile.providerAccountId}
  `;
  const existing = linked.length > 0 ? null : await findUserByEmail(norm);

  const decision = decideOAuthLink({
    alreadyLinked: linked.length > 0,
    providerEmailVerified: profile.emailVerified,
    existing: existing
      ? { emailVerified: existing.emailVerified, hasPassword: Boolean(existing.passwordHash) }
      : null,
  });

  if (decision.kind === "use-linked") {
    const r = linked[0];
    return {
      id: r.id as string,
      name: r.name as string,
      email: r.email as string,
      passwordHash: r.password_hash as string | null,
      emailVerified: r.email_verified as boolean,
      createdAt: r.created_at as string,
    };
  }

  if (decision.kind === "reject-unverified") throw new Error(OAUTH_EMAIL_UNVERIFIED);

  if (decision.kind === "link-existing" && existing) {
    if (decision.clearPassword) {
      await sql`UPDATE lelu_users SET email_verified = TRUE, password_hash = NULL WHERE id = ${existing.id}`;
    } else if (decision.markVerified) {
      await sql`UPDATE lelu_users SET email_verified = TRUE WHERE id = ${existing.id}`;
    }
    await sql`
      INSERT INTO lelu_oauth_accounts (id, user_id, provider, provider_account_id)
      VALUES (${randomBytes(16).toString("hex")}, ${existing.id}, ${provider}, ${profile.providerAccountId})
    `;
    return {
      ...existing,
      emailVerified: true,
      passwordHash: decision.clearPassword ? null : existing.passwordHash,
    };
  }

  const user: User = {
    id: randomBytes(16).toString("hex"),
    name: profile.name.trim(),
    email: norm,
    passwordHash: null,
    emailVerified: true,
    createdAt: new Date().toISOString(),
  };
  await sql`
    INSERT INTO lelu_users (id, name, email, password_hash, email_verified, created_at)
    VALUES (${user.id}, ${user.name}, ${user.email}, ${user.passwordHash}, ${user.emailVerified}, NOW())
  `;
  await sql`
    INSERT INTO lelu_oauth_accounts (id, user_id, provider, provider_account_id)
    VALUES (${randomBytes(16).toString("hex")}, ${user.id}, ${provider}, ${profile.providerAccountId})
  `;
  return user;
}

export async function markEmailVerified(userId: string): Promise<void> {
  const sql = db();
  await sql`UPDATE lelu_users SET email_verified = TRUE WHERE id = ${userId}`;
}

export async function recordLogin(userId: string): Promise<void> {
  const sql = db();
  await sql`UPDATE lelu_users SET last_login_at = NOW() WHERE id = ${userId}`;
}

// ── Email verification and password reset tokens ──────────────────────────────
// The emailed link carries the raw token; the database stores only its
// SHA-256, so a copy of the database can't be used to verify or reset
// accounts. A token is used up by a single DELETE ... RETURNING, so two
// requests racing with the same link can't both succeed.

export async function createVerificationToken(userId: string): Promise<string> {
  await ensureSchema();
  const sql = db();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Delete any previous tokens for this user
  await sql`DELETE FROM lelu_email_tokens WHERE user_id = ${userId}`;
  await sql`
    INSERT INTO lelu_email_tokens (token, user_id, expires_at, created_at)
    VALUES (${sha256(token)}, ${userId}, ${expiresAt.toISOString()}, NOW())
  `;

  return token;
}

export async function consumeVerificationToken(
  token: string
): Promise<{ userId: string } | null> {
  const sql = db();
  const rows = await sql`
    DELETE FROM lelu_email_tokens WHERE token = ${sha256(token)}
    RETURNING user_id, expires_at
  `;
  if (rows.length === 0) return null;
  if (new Date(rows[0].expires_at as string) < new Date()) return null;
  return { userId: rows[0].user_id as string };
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  await ensureSchema();
  const sql = db();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Invalidate any previous reset tokens for this user.
  await sql`DELETE FROM lelu_password_reset_tokens WHERE user_id = ${userId}`;
  await sql`
    INSERT INTO lelu_password_reset_tokens (token, user_id, expires_at, created_at)
    VALUES (${sha256(token)}, ${userId}, ${expiresAt.toISOString()}, NOW())
  `;

  return token;
}

export async function consumePasswordResetToken(
  token: string
): Promise<{ userId: string } | null> {
  const sql = db();
  const rows = await sql`
    DELETE FROM lelu_password_reset_tokens WHERE token = ${sha256(token)}
    RETURNING user_id, expires_at
  `;
  if (rows.length === 0) return null;
  if (new Date(rows[0].expires_at as string) < new Date()) return null;
  return { userId: rows[0].user_id as string };
}

/** Sets a new password and signs the user out everywhere. */
export async function updateUserPassword(userId: string, newPassword: string): Promise<void> {
  const sql = db();
  await sql`UPDATE lelu_users SET password_hash = ${hashPassword(newPassword)} WHERE id = ${userId}`;
  // A reset is often how someone recovers a compromised account: any session
  // opened before it, including an attacker's, must stop working.
  await endAllSessions(userId);
}

// ── Session helpers ───────────────────────────────────────────────────────────

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    secure: process.env.NODE_ENV === "production",
  };
}

/**
 * Starts a session for a user who just proved who they are, and returns the
 * signed token to put in the session cookie. The token carries a random
 * session id; the session lasts only while its row in lelu_sessions does.
 */
export async function createSession(user: {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}): Promise<string> {
  await ensureSchema();
  const sql = db();
  const sid = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL * 1000);
  // Housekeeping: drop this user's expired sessions.
  await sql`DELETE FROM lelu_sessions WHERE user_id = ${user.id} AND expires_at < NOW()`;
  await sql`
    INSERT INTO lelu_sessions (id_hash, user_id, expires_at)
    VALUES (${sha256(sid)}, ${user.id}, ${expiresAt.toISOString()})
  `;
  return signJWT({ userId: user.id, email: user.email, name: user.name, emailVerified: user.emailVerified, sid });
}

/** Ends the session a cookie token belongs to (logout). Safe to call with any value. */
export async function endSession(token: string | undefined): Promise<void> {
  const payload = token ? verifyJWT(token) : null;
  if (!payload?.sid) return;
  const sql = db();
  await sql`DELETE FROM lelu_sessions WHERE id_hash = ${sha256(payload.sid)}`;
}

/** Ends every session a user has, on every device. */
export async function endAllSessions(userId: string): Promise<void> {
  const sql = db();
  await sql`DELETE FROM lelu_sessions WHERE user_id = ${userId}`;
}

/**
 * The signed-in user, or null. Besides checking the token's signature and
 * expiry, the session must still exist on the server, so a logged-out,
 * reset or deleted session stops working at once. Name, email and verified
 * status come from the database, not from the token, so they are current.
 * Tokens issued before server-side sessions existed carry no session id and
 * are no longer accepted.
 */
export async function getCurrentUser(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const payload = verifyJWT(token);
    if (!payload?.sid) return null;

    await ensureSchema();
    const sql = db();
    const rows = await sql`
      SELECT u.id, u.email, u.name, u.email_verified
      FROM lelu_sessions s
      JOIN lelu_users u ON u.id = s.user_id
      WHERE s.id_hash = ${sha256(payload.sid)} AND s.expires_at > NOW()
    `;
    if (rows.length === 0 || rows[0].id !== payload.userId) return null;
    const r = rows[0];
    return {
      ...payload,
      email: r.email as string,
      name: r.name as string,
      emailVerified: r.email_verified as boolean,
    };
  } catch {
    return null;
  }
}

// ── Admin access ──────────────────────────────────────────────────────────────
// Allowlist of emails permitted to see the internal analytics dashboard.
// Configure via ADMIN_EMAILS (comma-separated); falls back to the owner account.
const DEFAULT_ADMIN_EMAILS = ["abenezerg@lelu-ai.com"];

export function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS;
  const list = raw
    ? raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
    : DEFAULT_ADMIN_EMAILS;
  return list;
}

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase().trim());
}

/** Returns the current session only if it belongs to an admin, else null. */
export async function getAdminUser(): Promise<SessionPayload | null> {
  const session = await getCurrentUser();
  if (!session || !isAdminEmail(session.email)) return null;
  return session;
}
