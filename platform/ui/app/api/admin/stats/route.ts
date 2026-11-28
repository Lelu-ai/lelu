import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { db, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Internal analytics — owner/admin only. Aggregates platform-wide metrics
// (users, activity, credentials, authorization decisions) from Postgres.
//
// Each section is loaded on its own. A section that fails comes back as null
// with its error message in `errors`, so one bad query no longer blanks the
// whole page behind "Failed to load analytics", and the admin can see what
// actually went wrong.

const num = (v: unknown) => Number(v ?? 0);
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v ? String(v) : null);

const USER_LIST_LIMIT = 500;

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    // 404 rather than 403 so the endpoint's existence isn't advertised.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const errors: Record<string, string> = {};

  // Tables normally exist already; if the setup step fails, still try the
  // queries and report the setup error alongside whatever they return.
  try {
    await ensureSchema();
  } catch (err) {
    console.error("[admin/stats] schema", err);
    errors.schema = err instanceof Error ? err.message : String(err);
  }

  let sql: ReturnType<typeof db>;
  try {
    sql = db();
  } catch (err) {
    console.error("[admin/stats] db", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Database is not configured" },
      { status: 500 },
    );
  }

  async function section<T>(name: string, run: () => Promise<T>): Promise<T | null> {
    try {
      return await run();
    } catch (err) {
      console.error(`[admin/stats] ${name}`, err);
      errors[name] = err instanceof Error ? err.message : String(err);
      return null;
    }
  }

  const [users, active, resources, decisions, signupTrend, userList, topActive] = await Promise.all([
    section("users", async () => {
      const [u] = await sql`
        SELECT
          COUNT(*)                                                          AS total,
          COUNT(*) FILTER (WHERE email_verified)                            AS verified,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')  AS new_24h,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')    AS new_7d,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')   AS new_30d
        FROM lelu_users
      `;
      return {
        total: num(u.total),
        verified: num(u.verified),
        unverified: num(u.total) - num(u.verified),
        new24h: num(u.new_24h),
        new7d: num(u.new_7d),
        new30d: num(u.new_30d),
      };
    }),

    // Distinct users who logged in, made a live authorization call, or used
    // an API key within the window.
    section("active", async () => {
      const [a] = await sql`
        SELECT
          COUNT(*) FILTER (WHERE last_active > NOW() - INTERVAL '24 hours') AS active_24h,
          COUNT(*) FILTER (WHERE last_active > NOW() - INTERVAL '7 days')   AS active_7d,
          COUNT(*) FILTER (WHERE last_active > NOW() - INTERVAL '30 days')  AS active_30d
        FROM (
          SELECT user_id, MAX(ts) AS last_active FROM (
            SELECT id AS user_id, last_login_at AS ts FROM lelu_users WHERE last_login_at IS NOT NULL
            UNION ALL
            SELECT user_id, created_at AS ts FROM lelu_audit_events
              WHERE user_id IS NOT NULL AND created_at > NOW() - INTERVAL '30 days'
            UNION ALL
            SELECT user_id, last_used_at AS ts FROM lelu_api_keys WHERE last_used_at IS NOT NULL
          ) evt
          GROUP BY user_id
        ) per_user
      `;
      return { d1: num(a.active_24h), d7: num(a.active_7d), d30: num(a.active_30d) };
    }),

    section("resources", async () => {
      const [c] = await sql`
        SELECT
          (SELECT COUNT(*) FROM lelu_api_keys WHERE NOT revoked)      AS active_keys,
          (SELECT COUNT(*) FROM lelu_api_keys)                        AS total_keys,
          (SELECT COUNT(*) FROM lelu_agents WHERE status = 'active')  AS active_agents,
          (SELECT COUNT(*) FROM lelu_agents)                          AS total_agents,
          (SELECT COUNT(*) FROM lelu_policies WHERE is_active)        AS active_policies
      `;
      return {
        activeKeys: num(c.active_keys),
        totalKeys: num(c.total_keys),
        activeAgents: num(c.active_agents),
        totalAgents: num(c.total_agents),
        activePolicies: num(c.active_policies),
      };
    }),

    // Real customer calls only (mode 'live'). Calls made with the public
    // sandbox key are counted separately so demo traffic can't inflate them.
    section("decisions", async () => {
      const [d] = await sql`
        SELECT
          COUNT(*) FILTER (WHERE mode = 'live')                                                     AS total,
          COUNT(*) FILTER (WHERE mode = 'live' AND created_at > NOW() - INTERVAL '24 hours')         AS total_24h,
          COUNT(*) FILTER (WHERE mode = 'live' AND decision = 'allowed')                             AS allowed,
          COUNT(*) FILTER (WHERE mode = 'live' AND decision = 'denied')                              AS denied,
          COUNT(*) FILTER (WHERE mode = 'live' AND decision = 'human_review')                        AS human_review,
          COUNT(*) FILTER (WHERE mode = 'live' AND decision = 'compute')                             AS compute,
          COUNT(*) FILTER (WHERE mode <> 'live')                                                     AS sandbox
        FROM lelu_audit_events
      `;
      return {
        total: num(d.total),
        total24h: num(d.total_24h),
        allowed: num(d.allowed),
        denied: num(d.denied),
        humanReview: num(d.human_review),
        compute: num(d.compute),
        sandbox: num(d.sandbox),
      };
    }),

    section("signupTrend", async () => {
      const rows = await sql`
        SELECT to_char(created_at::date, 'YYYY-MM-DD') AS day, COUNT(*) AS count
        FROM lelu_users
        WHERE created_at > NOW() - INTERVAL '14 days'
        GROUP BY created_at::date
        ORDER BY created_at::date
      `;
      return rows.map((r) => ({ day: String(r.day), count: num(r.count) }));
    }),

    // Every account, newest first, verified or not, so unverified signups can
    // be followed up.
    section("users list", async () => {
      const rows = await sql`
        SELECT name, email, email_verified, plan, created_at, last_login_at
        FROM lelu_users
        ORDER BY created_at DESC
        LIMIT ${USER_LIST_LIMIT}
      `;
      return rows.map((r) => ({
        name: String(r.name ?? ""),
        email: String(r.email ?? ""),
        emailVerified: Boolean(r.email_verified),
        plan: String(r.plan ?? "free"),
        createdAt: iso(r.created_at) ?? "",
        lastLoginAt: iso(r.last_login_at),
      }));
    }),

    // Most active users by live call volume (last 30 days).
    section("topActive", async () => {
      const rows = await sql`
        SELECT u.email, u.name, COUNT(*) AS events
        FROM lelu_audit_events e
        JOIN lelu_users u ON u.id = e.user_id
        WHERE e.created_at > NOW() - INTERVAL '30 days' AND e.mode = 'live'
        GROUP BY u.id, u.email, u.name
        ORDER BY events DESC
        LIMIT 10
      `;
      return rows.map((r) => ({ email: String(r.email), name: String(r.name ?? ""), events: num(r.events) }));
    }),
  ]);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    users,
    active,
    resources,
    decisions,
    signupTrend,
    userList,
    userListLimit: USER_LIST_LIMIT,
    topActive,
    errors,
  });
}
