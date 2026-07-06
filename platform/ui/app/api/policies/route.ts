import { NextRequest, NextResponse } from "next/server";
import { resolveUserId } from "@/lib/request-auth";
import { listPolicies, createPolicy } from "@/lib/policies";
import { pushPolicyToEngine } from "@/lib/policy-sync";

export async function GET(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const policies = await listPolicies(userId);
    return NextResponse.json({ policies });
  } catch (err) {
    console.error("[policies/GET]", err);
    return NextResponse.json({ error: "Failed to fetch policies" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, description, rules } = (body as Record<string, unknown>) ?? {};

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Policy name is required" }, { status: 400 });
  }
  if (name.length > 64) {
    return NextResponse.json({ error: "Name must be 64 characters or less" }, { status: 400 });
  }

  try {
    const policy = await createPolicy(
      userId,
      name.trim(),
      typeof description === "string" ? description.trim() : "",
      Array.isArray(rules) ? rules : [],
    );

    pushPolicyToEngine(userId).then((result) => {
      if (!result.ok) console.warn("[policies/POST] engine sync failed:", result.error);
    }).catch((err) => console.warn("[policies/POST] engine sync error:", err));

    return NextResponse.json({ policy }, { status: 201 });
  } catch (err) {
    console.error("[policies/POST]", err);
    return NextResponse.json({ error: "Failed to create policy" }, { status: 500 });
  }
}
