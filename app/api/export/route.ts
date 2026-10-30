import { env } from "cloudflare:workers";
import { documentsForExport } from "@/db/fiscal-store";
import { buildDocumentCsv, type ExportDocument } from "@/lib/export-csv";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedMonth = url.searchParams.get("month") || "";
  const month = /^\d{4}-\d{2}$/.test(requestedMonth) ? requestedMonth : undefined;
  try {
    const documents = await documentsForExport(env.DB, month) as ExportDocument[];
    const csv = buildDocumentCsv(documents);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="lancamentos-${month ?? "todos"}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("Export failed", { error: error instanceof Error ? error.message : "unknown" });
    return Response.json({ error: "Não foi possível gerar a exportação." }, { status: 500 });
  }
}
