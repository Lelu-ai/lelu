import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db, ensureSchema } from "./db";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  emailVerified: boolean;
  iat: number;
  exp: number;
}

export const SESSION_COOKIE = "lelu_session";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

// ── JWT (zero-dependency, Node.js crypto) ─────────────────────────────────────

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function getSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set. Generate one with: openssl rand -base64 32");
  return s;
}

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

export async function createUser(name: string, email: string, password: string): Promise<User> {
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
    emailVerified: false,
    createdAt: new Date().toISOString(),
  };

  await sql`
    INSERT INTO lelu_users (id, name, email, password_hash, email_verified, created_at)
    VALUES (${user.id}, ${user.name}, ${user.email}, ${user.passwordHash}, FALSE, NOW())
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
    passwordHash: r.password_hash as string,
    emailVerified: r.email_verified as boolean,
    createdAt: r.created_at as string,
  };
}

export async function markEmailVerified(userId: string): Promise<void> {
  const sql = db();
  await sql`UPDATE lelu_users SET email_verified = TRUE WHERE id = ${userId}`;
}

// ── Email verification tokens ─────────────────────────────────────────────────

export async function createVerificationToken(userId: string): Promise<string> {
  await ensureSchema();
  const sql = db();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Delete any previous tokens for this user
  await sql`DELETE FROM lelu_email_tokens WHERE user_id = ${userId}`;
  await sql`
    INSERT INTO lelu_email_tokens (token, user_id, expires_at, created_at)
    VALUES (${token}, ${userId}, ${expiresAt.toISOString()}, NOW())
  `;

  return token;
}

export async function consumeVerificationToken(
  token: string
): Promise<{ userId: string } | null> {
  const sql = db();
  const rows = await sql`
    SELECT user_id, expires_at FROM lelu_email_tokens WHERE token = ${token}
  `;
  if (rows.length === 0) return null;

  const row = rows[0];
  if (new Date(row.expires_at as string) < new Date()) {
    await sql`DELETE FROM lelu_email_tokens WHERE token = ${token}`;
    return null;
  }

  await sql`DELETE FROM lelu_email_tokens WHERE token = ${token}`;
  return { userId: row.user_id as string };
}

// ── Password reset tokens ─────────────────────────────────────────────────────

export async function createPasswordResetToken(userId: string): Promise<string> {
  await ensureSchema();
  const sql = db();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Invalidate any previous reset tokens for this user.
  await sql`DELETE FROM lelu_password_reset_tokens WHERE user_id = ${userId}`;
  await sql`
    INSERT INTO lelu_password_reset_tokens (token, user_id, expires_at, created_at)
    VALUES (${token}, ${userId}, ${expiresAt.toISOString()}, NOW())
  `;

  return token;
}

export async function consumePasswordResetToken(
  token: string
): Promise<{ userId: string } | null> {
  const sql = db();
  const rows = await sql`
    SELECT user_id, expires_at FROM lelu_password_reset_tokens WHERE token = ${token}
  `;
  if (rows.length === 0) return null;

  const row = rows[0];
  if (new Date(row.expires_at as string) < new Date()) {
    await sql`DELETE FROM lelu_password_reset_tokens WHERE token = ${token}`;
    return null;
  }

  await sql`DELETE FROM lelu_password_reset_tokens WHERE token = ${token}`;
  return { userId: row.user_id as string };
}

export async function updateUserPassword(userId: string, newPassword: string): Promise<void> {
  const sql = db();
  await sql`UPDATE lelu_users SET password_hash = ${hashPassword(newPassword)} WHERE id = ${userId}`;
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

export async function getCurrentUser(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return verifyJWT(token);
  } catch {
    return null;
  }
}
