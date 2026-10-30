import { env } from "cloudflare:workers";
import { approveDocumentReview } from "@/db/fiscal-store";
import { validateReviewInput } from "@/lib/review";
import { authenticatedActorId } from "@/lib/request-identity";

export async function POST(request: Request) {
  const actorId = authenticatedActorId(request);
  if (!actorId) return Response.json({ error: "Autenticação necessária para revisar documentos." }, { status: 401 });
  let input;
  try {
    input = validateReviewInput(await request.json());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Revisão inválida." }, { status: 400 });
  }
  try {
    const result = await approveDocumentReview(env.DB, input, actorId);
    if (result.outcome === "not_found") return Response.json({ error: "Documento não encontrado." }, { status: 404 });
    if (result.outcome === "cancelled") return Response.json({ error: "Uma nota cancelada não pode gerar efeito financeiro." }, { status: 409 });
    if (result.outcome === "stale") return Response.json({ error: "O documento foi alterado por outra pessoa. Atualize a tela antes de salvar.", currentRevision: result.currentRevision }, { status: 409 });
    return Response.json(result);
  } catch (error) {
    console.error("Document review failed", { documentId: input.documentId, error: error instanceof Error ? error.message : "unknown" });
    return Response.json({ error: "Não foi possível registrar a revisão." }, { status: 500 });
  }
}
