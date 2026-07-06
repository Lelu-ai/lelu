import { NextRequest } from "next/server";
import { getCurrentUser } from "./auth";
import { validateApiKey } from "./apikeys";

/**
 * Resolves the acting user for an API route from either auth mechanism:
 * an `Authorization: Bearer lelu_sk_…` API key (SDK / curl callers) or the
 * dashboard session cookie. Returns null when neither is valid.
 */
export async function resolveUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const result = await validateApiKey(auth.slice(7).trim());
    return result?.userId ?? null;
  }
  const session = await getCurrentUser();
  return session?.userId ?? null;
}
