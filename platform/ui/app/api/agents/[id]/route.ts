import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAgent, setAgentStatus } from "@/lib/agents";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const agent = await getAgent(id, session.userId);
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  return NextResponse.json({ agent });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ok = await setAgentStatus(id, session.userId, "revoked");
  if (!ok) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  return NextResponse.json({ success: true, status: "revoked" });
}
