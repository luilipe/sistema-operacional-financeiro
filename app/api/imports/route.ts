import { env } from "cloudflare:workers";
import { looksLikeImportDocument, prepareImport, type ImportInput, type PreparedImport } from "@/lib/import-pipeline";
import { authenticatedActorId } from "@/lib/request-identity";
import { applyCancellationEvents, createImportBatch, existingFilesByHash, finalizeImportBatch, persistPreparedFile } from "@/db/fiscal-store";

const MAX_FILES = 500;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_BATCH_BYTES = 200 * 1024 * 1024;

export async function POST(request: Request) {
  const form = await request.formData();
  const files = form.getAll("files").filter((value): value is File => value instanceof File);
  if (!files.length) return Response.json({ error: "Selecione ao menos um XML ou PDF." }, { status: 400 });
  if (files.length > MAX_FILES) return Response.json({ error: `O lote aceita até ${MAX_FILES} arquivos.` }, { status: 400 });
  if (files.some((file) => file.size > MAX_FILE_BYTES)) return Response.json({ error: "Cada arquivo pode ter no máximo 20 MB." }, { status: 413 });
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_BATCH_BYTES) return Response.json({ error: "O lote pode ter no máximo 200 MB." }, { status: 413 });

  const actorId = authenticatedActorId(request);
  if (!actorId) return Response.json({ error: "Autenticação necessária para importar documentos." }, { status: 401 });
  const batchId = crypto.randomUUID();
  const label = String(form.get("label") || `Importação ${new Date().toLocaleDateString("pt-BR")}`).slice(0, 120);
  const inputs: ImportInput[] = await Promise.all(files.map(async (file) => ({ name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) })));
  if (inputs.some((file) => !looksLikeImportDocument(file.bytes))) {
    return Response.json({ error: "O lote contém conteúdo que não é XML nem PDF e foi bloqueado antes do armazenamento." }, { status: 415 });
  }
  let prepared = await prepareImport(inputs);
  await createImportBatch(env.DB, { id: batchId, label, fileCount: files.length, actorId });

  try {
    const existing = await existingFilesByHash(env.DB, prepared.map((file) => file.hash));
    prepared = prepared.map((file) => existing.has(file.hash) ? { ...file, status: "duplicate", record: undefined } as PreparedImport : file);

    for (const file of prepared) {
      const existingStorageKey = existing.get(file.hash);
      if (!existingStorageKey && file.status !== "duplicate") {
        const storageKey = `originals/${file.hash}/${safeFilename(file.name)}`;
        await env.BUCKET.put(storageKey, inputs[file.index].bytes, {
          httpMetadata: { contentType: file.type || "application/octet-stream" },
          customMetadata: { sha256: file.hash, originalName: file.name.slice(0, 160), batchId },
        });
      }
      await persistPreparedFile(env.DB, file, batchId, actorId, existingStorageKey);
    }

    await applyCancellationEvents(env.DB);
    const summary = summarize(prepared);
    await finalizeImportBatch(env.DB, batchId, summary);
    return Response.json({ batchId, label, summary, files: prepared.map(({ name, hash, classification, status, error }) => ({ name, hash, classification, status, error })) });
  } catch (error) {
    await env.DB.prepare(`UPDATE import_batches SET status='failed', completed_at=CURRENT_TIMESTAMP WHERE id=?`).bind(batchId).run();
    console.error("Import batch failed", { batchId, error: error instanceof Error ? error.message : "unknown" });
    return Response.json({ error: "A importação foi interrompida. O lote ficou registrado para nova tentativa.", batchId }, { status: 500 });
  }
}

function summarize(files: PreparedImport[]) {
  return {
    imported: files.filter((file) => file.status === "parsed").length,
    pending: files.filter((file) => file.status === "pending").length,
    rejected: files.filter((file) => file.status === "rejected").length,
    duplicate: files.filter((file) => file.status === "duplicate").length,
  };
}

function safeFilename(name: string) {
  return (name.split(/[\\/]/).pop() || "arquivo").normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 160) || "arquivo";
}
