import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listAgents, createAgent } from "@/lib/agents";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const agents = await listAgents(session.userId);
    return NextResponse.json({ agents });
  } catch (err) {
    console.error("[agents/GET]", err);
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, description, agentType, ownerEmail, scopes } = (body as Record<string, unknown>) ?? {};

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Agent name is required" }, { status: 400 });
  }
  if (name.length > 80) {
    return NextResponse.json({ error: "Name must be 80 characters or less" }, { status: 400 });
  }

  try {
    const agent = await createAgent({
      userId: session.userId,
      name: name.trim(),
      description: typeof description === "string" ? description : "",
      agentType: (agentType as "autonomous" | "assistant" | "workflow") ?? "autonomous",
      ownerEmail: typeof ownerEmail === "string" ? ownerEmail : "",
      scopes: Array.isArray(scopes) ? (scopes as string[]) : [],
    });
    return NextResponse.json({ agent }, { status: 201 });
  } catch (err) {
    console.error("[agents/POST]", err);
    return NextResponse.json({ error: "Failed to create agent" }, { status: 500 });
  }
}
