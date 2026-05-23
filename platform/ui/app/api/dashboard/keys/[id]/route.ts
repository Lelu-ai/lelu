import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { revokeApiKey } from "@/lib/apikeys";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: "Key ID is required" }, { status: 400 });
  }

  try {
    await revokeApiKey(id, session.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[keys/DELETE]", err);
    return NextResponse.json({ error: "Failed to revoke key" }, { status: 500 });
  }
}
