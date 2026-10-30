import type { PreparedImport } from "../lib/import-pipeline.ts";
import { toPersistenceRows } from "../lib/persistence-records.ts";
import type { ReviewInput } from "../lib/review.ts";

export async function createImportBatch(db: D1Database, batch: { id: string; label: string; fileCount: number; actorId: string }) {
  await db.prepare(`INSERT INTO import_batches (id, label, status, file_count, created_by) VALUES (?, ?, 'processing', ?, ?)`)
    .bind(batch.id, batch.label, batch.fileCount, batch.actorId).run();
}

export async function existingFilesByHash(db: D1Database, hashes: string[]): Promise<Map<string, string>> {
  if (!hashes.length) return new Map();
  const placeholders = hashes.map(() => "?").join(",");
  const result = await db.prepare(`SELECT hash, storage_key AS storageKey FROM original_files WHERE hash IN (${placeholders})`).bind(...hashes).all<{ hash: string; storageKey: string }>();
  return new Map(result.results.map((row) => [row.hash, row.storageKey]));
}

export async function persistPreparedFile(db: D1Database, prepared: PreparedImport, batchId: string, actorId: string, existingStorageKey?: string) {
  const rows = toPersistenceRows(prepared, batchId, actorId);
  if (existingStorageKey) rows.file.storageKey = existingStorageKey;
  const statements: D1PreparedStatement[] = [
    db.prepare(`INSERT INTO original_files (id, batch_id, hash, original_name, content_type, size, storage_key, classification, outcome, error, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(rows.file.id, rows.file.batchId, rows.file.hash, rows.file.originalName, rows.file.contentType, rows.file.size, rows.file.storageKey, rows.file.classification, rows.file.outcome, rows.file.error, rows.file.createdBy),
  ];

  if (rows.document) {
    const d = rows.document;
    statements.push(db.prepare(`INSERT INTO fiscal_documents
      (id, access_key, environment, model, series, number, issue_date, nature, issuer_tax_id, issuer_name, recipient_tax_id, recipient_name, total_cents, fiscal_total_cents, protocol, status_code, fiscal_status, review_status, source_file_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET series=excluded.series, number=excluded.number, issue_date=excluded.issue_date, nature=excluded.nature,
      issuer_tax_id=excluded.issuer_tax_id, issuer_name=excluded.issuer_name, recipient_tax_id=excluded.recipient_tax_id,
      recipient_name=excluded.recipient_name, total_cents=excluded.total_cents, fiscal_total_cents=excluded.fiscal_total_cents,
      protocol=excluded.protocol, status_code=excluded.status_code, source_file_hash=excluded.source_file_hash, updated_at=CURRENT_TIMESTAMP`)
      .bind(d.id, d.accessKey, d.environment, d.model, d.series, d.number, d.issueDate, d.nature, d.issuerTaxId, d.issuerName, d.recipientTaxId, d.recipientName, d.totalCents, d.fiscalTotalCents, d.protocol, d.statusCode, d.fiscalStatus, d.reviewStatus, d.sourceFileHash));
    for (const item of rows.items) {
      statements.push(db.prepare(`INSERT INTO fiscal_items (id, document_id, number, code, description, cfop, quantity, unit, unit_price, total_cents)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET code=excluded.code, description=excluded.description, cfop=excluded.cfop, quantity=excluded.quantity,
        unit=excluded.unit, unit_price=excluded.unit_price, total_cents=excluded.total_cents`)
        .bind(item.id, item.documentId, item.number, item.code, item.description, item.cfop, item.quantity, item.unit, item.unitPrice, item.totalCents));
    }
  }

  if (rows.event) {
    const e = rows.event;
    statements.push(db.prepare(`INSERT INTO fiscal_events (id, access_key, environment, event_type, sequence, status_code, protocol, registered_at, cancelled, source_file_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status_code=excluded.status_code, protocol=excluded.protocol, registered_at=excluded.registered_at,
      cancelled=excluded.cancelled, source_file_hash=excluded.source_file_hash`)
      .bind(e.id, e.accessKey, e.environment, e.eventType, e.sequence, e.statusCode, e.protocol, e.registeredAt, e.cancelled, e.sourceFileHash));
  }

  if (rows.inutilization) {
    const i = rows.inutilization;
    statements.push(db.prepare(`INSERT INTO inutilizations (id, environment, tax_id, year, model, series, start_number, end_number, status_code, protocol, source_file_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`)
      .bind(i.id, i.environment, i.taxId, i.year, i.model, i.series, i.startNumber, i.endNumber, i.statusCode, i.protocol, i.sourceFileHash));
  }

  await db.batch(statements);
}

export async function applyCancellationEvents(db: D1Database) {
  await db.prepare(`UPDATE fiscal_documents SET fiscal_status='cancelled', updated_at=CURRENT_TIMESTAMP
    WHERE fiscal_status!='cancelled' AND EXISTS (
      SELECT 1 FROM fiscal_events e WHERE e.access_key=fiscal_documents.access_key
      AND e.environment=fiscal_documents.environment AND e.cancelled=1
    )`).run();
}

export async function finalizeImportBatch(db: D1Database, batchId: string, summary: { imported: number; pending: number; rejected: number; duplicate: number }) {
  const status = summary.rejected > 0 || summary.pending > 0 ? "partial" : "completed";
  await db.prepare(`UPDATE import_batches SET status=?, imported_count=?, pending_count=?, rejected_count=?, duplicate_count=?, completed_at=CURRENT_TIMESTAMP WHERE id=?`)
    .bind(status, summary.imported, summary.pending, summary.rejected, summary.duplicate, batchId).run();
}

export async function listDocuments(db: D1Database, limit = 100) {
  const documents = await db.prepare(`SELECT id, access_key AS accessKey, number, series, issue_date AS issueDate, recipient_name AS recipientName,
    nature, total_cents AS totalCents, fiscal_status AS fiscalStatus, review_status AS reviewStatus, managerial_category AS managerialCategory,
    managerial_value_cents AS managerialValueCents, revision FROM fiscal_documents ORDER BY issue_date DESC, number DESC LIMIT ?`).bind(limit).all();
  const totals = await db.prepare(`SELECT COUNT(*) AS documentCount, COALESCE(SUM(total_cents),0) AS grossCents,
    COALESCE(SUM(CASE WHEN fiscal_status='cancelled' THEN total_cents ELSE 0 END),0) AS cancelledCents,
    COALESCE(SUM(CASE WHEN fiscal_status!='cancelled' THEN total_cents ELSE 0 END),0) AS activeCents,
    COALESCE(SUM(CASE WHEN review_status='pending' AND fiscal_status!='cancelled' THEN 1 ELSE 0 END),0) AS pendingCount,
    COALESCE(SUM(CASE WHEN review_status='pending' AND fiscal_status!='cancelled' THEN total_cents ELSE 0 END),0) AS pendingCents,
    COALESCE(SUM(CASE WHEN review_status='approved' AND fiscal_status!='cancelled' THEN 1 ELSE 0 END),0) AS approvedCount,
    COALESCE(SUM(CASE WHEN review_status='approved' AND fiscal_status!='cancelled' THEN COALESCE(managerial_value_cents,total_cents) ELSE 0 END),0) AS approvedCents,
    COALESCE(SUM(CASE WHEN fiscal_status='cancelled' THEN 1 ELSE 0 END),0) AS cancelledCount FROM fiscal_documents`).first();
  return { documents: documents.results, totals };
}

export async function approveDocumentReview(db: D1Database, input: ReviewInput, actorId: string) {
  const before = await db.prepare(`SELECT id, fiscal_status AS fiscalStatus, review_status AS reviewStatus, managerial_category AS managerialCategory,
    managerial_value_cents AS managerialValueCents, revision FROM fiscal_documents WHERE id=?`).bind(input.documentId).first<Record<string, unknown>>();
  if (!before) return { outcome: "not_found" as const };
  if (before.fiscalStatus === "cancelled") return { outcome: "cancelled" as const };
  if (before.revision !== input.revision) return { outcome: "stale" as const, currentRevision: before.revision };

  const after = { reviewStatus: "approved", managerialCategory: input.category, managerialValueCents: input.managerialValueCents, revision: input.revision + 1 };
  const [update] = await db.batch([
    db.prepare(`UPDATE fiscal_documents SET review_status='approved', managerial_category=?, managerial_value_cents=?,
      reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP, revision=revision+1, updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=?`)
      .bind(input.category, input.managerialValueCents, actorId, input.documentId, input.revision),
    db.prepare(`INSERT INTO audit_log (id, actor_id, entity_type, entity_id, action, before_json, after_json, reason)
      SELECT ?, ?, 'fiscal_document', ?, 'approve_review', ?, ?, ? WHERE changes()=1`)
      .bind(crypto.randomUUID(), actorId, input.documentId, JSON.stringify(before), JSON.stringify(after), input.reason || null),
  ]);
  if ((update.meta.changes ?? 0) !== 1) return { outcome: "stale" as const };
  return { outcome: "approved" as const, revision: input.revision + 1 };
}

export async function documentsForExport(db: D1Database, month?: string) {
  const filter = month ? "WHERE issue_date LIKE ?" : "";
  const statement = db.prepare(`SELECT issue_date AS issueDate, recipient_name AS recipientName, total_cents AS totalCents,
    managerial_value_cents AS managerialValueCents, managerial_category AS managerialCategory, number, series,
    access_key AS accessKey, fiscal_status AS fiscalStatus, review_status AS reviewStatus
    FROM fiscal_documents ${filter} ORDER BY issue_date, number`);
  const result = month ? await statement.bind(`${month}%`).all() : await statement.all();
  return result.results;
}
