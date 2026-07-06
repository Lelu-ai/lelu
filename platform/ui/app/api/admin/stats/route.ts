import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { db, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

// Internal analytics — owner/admin only. Aggregates platform-wide metrics
// (users, activity, credentials, authorization decisions) from Postgres.
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    // 404 rather than 403 so the endpoint's existence isn't advertised.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await ensureSchema();
    const sql = db();

    const [
      users,
      active,
      credentials,
      decisions,
      signupTrend,
      recentSignups,
      topActive,
    ] = await Promise.all([
      // User totals + signup windows
      sql`
        SELECT
          COUNT(*)                                                          AS total,
          COUNT(*) FILTER (WHERE email_verified)                            AS verified,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')  AS new_24h,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')    AS new_7d,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')   AS new_30d
        FROM lelu_users
      `,
      // Active users: distinct users who logged in, made an authorization
      // decision, or used an API key within the window.
      sql`
        SELECT
          COUNT(*) FILTER (WHERE last_active > NOW() - INTERVAL '24 hours') AS active_24h,
          COUNT(*) FILTER (WHERE last_active > NOW() - INTERVAL '7 days')   AS active_7d,
          COUNT(*) FILTER (WHERE last_active > NOW() - INTERVAL '30 days')  AS active_30d
        FROM (
          SELECT user_id, MAX(ts) AS last_active FROM (
            SELECT id AS user_id, last_login_at AS ts FROM lelu_users WHERE last_login_at IS NOT NULL
            UNION ALL
            SELECT user_id, created_at AS ts FROM lelu_audit_events WHERE user_id IS NOT NULL
            UNION ALL
            SELECT user_id, last_used_at AS ts FROM lelu_api_keys WHERE last_used_at IS NOT NULL
          ) evt
          GROUP BY user_id
        ) per_user
      `,
      // Credential + resource counts
      sql`
        SELECT
          (SELECT COUNT(*) FROM lelu_api_keys WHERE NOT revoked)      AS active_keys,
          (SELECT COUNT(*) FROM lelu_api_keys)                        AS total_keys,
          (SELECT COUNT(*) FROM lelu_agents WHERE status = 'active')  AS active_agents,
          (SELECT COUNT(*) FROM lelu_agents)                          AS total_agents,
          (SELECT COUNT(*) FROM lelu_policies WHERE is_active)        AS active_policies
      `,
      // Authorization decision breakdown
      sql`
        SELECT
          COUNT(*)                                                          AS total,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')  AS total_24h,
          COUNT(*) FILTER (WHERE decision = 'allowed')                      AS allowed,
          COUNT(*) FILTER (WHERE decision = 'denied')                       AS denied,
          COUNT(*) FILTER (WHERE decision = 'human_review')                 AS human_review,
          COUNT(*) FILTER (WHERE decision = 'compute')                      AS compute
        FROM lelu_audit_events
      `,
      // Daily signups, last 14 days
      sql`
        SELECT to_char(created_at::date, 'YYYY-MM-DD') AS day, COUNT(*) AS count
        FROM lelu_users
        WHERE created_at > NOW() - INTERVAL '14 days'
        GROUP BY created_at::date
        ORDER BY created_at::date
      `,
      // Newest accounts
      sql`
        SELECT id, name, email, email_verified, created_at, last_login_at
        FROM lelu_users
        ORDER BY created_at DESC
        LIMIT 10
      `,
      // Most active users by audit volume (last 30 days)
      sql`
        SELECT u.email, u.name, COUNT(*) AS events
        FROM lelu_audit_events e
        JOIN lelu_users u ON u.id = e.user_id
        WHERE e.created_at > NOW() - INTERVAL '30 days'
        GROUP BY u.id, u.email, u.name
        ORDER BY events DESC
        LIMIT 10
      `,
    ]);

    const u = users[0];
    const a = active[0];
    const c = credentials[0];
    const d = decisions[0];
    const num = (v: unknown) => Number(v ?? 0);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      users: {
        total: num(u.total),
        verified: num(u.verified),
        new24h: num(u.new_24h),
        new7d: num(u.new_7d),
        new30d: num(u.new_30d),
      },
      active: {
        d1: num(a.active_24h),
        d7: num(a.active_7d),
        d30: num(a.active_30d),
      },
      resources: {
        activeKeys: num(c.active_keys),
        totalKeys: num(c.total_keys),
        activeAgents: num(c.active_agents),
        totalAgents: num(c.total_agents),
        activePolicies: num(c.active_policies),
      },
      decisions: {
        total: num(d.total),
        total24h: num(d.total_24h),
        allowed: num(d.allowed),
        denied: num(d.denied),
        humanReview: num(d.human_review),
        compute: num(d.compute),
      },
      signupTrend: signupTrend.map((r) => ({ day: r.day as string, count: num(r.count) })),
      recentSignups: recentSignups.map((r) => ({
        name: r.name as string,
        email: r.email as string,
        emailVerified: r.email_verified as boolean,
        createdAt: r.created_at as string,
        lastLoginAt: (r.last_login_at as string) ?? null,
      })),
      topActive: topActive.map((r) => ({
        email: r.email as string,
        name: r.name as string,
        events: num(r.events),
      })),
    });
  } catch (err) {
    console.error("[admin/stats]", err);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
