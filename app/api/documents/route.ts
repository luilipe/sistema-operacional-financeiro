import { env } from "cloudflare:workers";
import { listDocuments } from "@/db/fiscal-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = Number(url.searchParams.get("limit") || 100);
  const limit = Number.isInteger(requested) ? Math.min(200, Math.max(1, requested)) : 100;
  try {
    return Response.json(await listDocuments(env.DB, limit));
  } catch (error) {
    console.error("Document list failed", { error: error instanceof Error ? error.message : "unknown" });
    return Response.json({ error: "Os documentos estão temporariamente indisponíveis." }, { status: 503 });
  }
}
