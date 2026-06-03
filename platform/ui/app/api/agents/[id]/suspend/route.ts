import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { setAgentStatus } from "@/lib/agents";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ok = await setAgentStatus(id, session.userId, "suspended");
  if (!ok) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  return NextResponse.json({ success: true, status: "suspended" });
}
