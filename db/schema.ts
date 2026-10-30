import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const importBatches = sqliteTable("import_batches", {
  id: text("id").primaryKey(), label: text("label").notNull(), status: text("status").notNull().default("processing"),
  fileCount: integer("file_count").notNull().default(0), importedCount: integer("imported_count").notNull().default(0),
  pendingCount: integer("pending_count").notNull().default(0), rejectedCount: integer("rejected_count").notNull().default(0),
  duplicateCount: integer("duplicate_count").notNull().default(0), createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), completedAt: text("completed_at"),
}, (table) => [index("idx_import_batches_created_at").on(table.createdAt)]);

export const originalFiles = sqliteTable("original_files", {
  id: text("id").primaryKey(), batchId: text("batch_id").notNull().references(() => importBatches.id), hash: text("hash").notNull(),
  originalName: text("original_name").notNull(), contentType: text("content_type").notNull(), size: integer("size").notNull(),
  storageKey: text("storage_key").notNull(), classification: text("classification").notNull(), outcome: text("outcome").notNull(),
  error: text("error"), createdBy: text("created_by").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_original_files_batch_id").on(table.batchId), index("idx_original_files_hash").on(table.hash)]);

export const fiscalDocuments = sqliteTable("fiscal_documents", {
  id: text("id").primaryKey(), accessKey: text("access_key").notNull(), environment: text("environment").notNull(),
  model: text("model").notNull(), series: text("series").notNull(), number: text("number").notNull(), issueDate: text("issue_date").notNull(),
  nature: text("nature").notNull(), issuerTaxId: text("issuer_tax_id").notNull(), issuerName: text("issuer_name").notNull(),
  recipientTaxId: text("recipient_tax_id").notNull(), recipientName: text("recipient_name").notNull(), totalCents: integer("total_cents").notNull(),
  fiscalTotalCents: integer("fiscal_total_cents").notNull(), protocol: text("protocol").notNull(), statusCode: text("status_code").notNull(),
  fiscalStatus: text("fiscal_status").notNull().default("authorized"), reviewStatus: text("review_status").notNull().default("pending"),
  managerialCategory: text("managerial_category"), managerialValueCents: integer("managerial_value_cents"), reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"), revision: integer("revision").notNull().default(1), sourceFileHash: text("source_file_hash").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("uq_fiscal_documents_identity").on(table.environment, table.model, table.accessKey),
  index("idx_fiscal_documents_issue_date").on(table.issueDate), index("idx_fiscal_documents_review_status").on(table.reviewStatus),
]);

export const fiscalItems = sqliteTable("fiscal_items", {
  id: text("id").primaryKey(), documentId: text("document_id").notNull().references(() => fiscalDocuments.id), number: integer("number").notNull(),
  code: text("code").notNull(), description: text("description").notNull(), cfop: text("cfop").notNull(), quantity: text("quantity").notNull(),
  unit: text("unit").notNull(), unitPrice: text("unit_price").notNull(), totalCents: integer("total_cents").notNull(),
}, (table) => [uniqueIndex("uq_fiscal_items_document_number").on(table.documentId, table.number), index("idx_fiscal_items_cfop").on(table.cfop)]);

export const fiscalEvents = sqliteTable("fiscal_events", {
  id: text("id").primaryKey(), accessKey: text("access_key").notNull(), environment: text("environment").notNull(),
  eventType: text("event_type").notNull(), sequence: text("sequence").notNull(), statusCode: text("status_code").notNull(),
  protocol: text("protocol").notNull(), registeredAt: text("registered_at").notNull(), cancelled: integer("cancelled", { mode: "boolean" }).notNull().default(false),
  sourceFileHash: text("source_file_hash").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("uq_fiscal_events_identity").on(table.environment, table.accessKey, table.eventType, table.sequence), index("idx_fiscal_events_access_key").on(table.accessKey)]);

export const inutilizations = sqliteTable("inutilizations", {
  id: text("id").primaryKey(), environment: text("environment").notNull(), taxId: text("tax_id").notNull(), year: text("year").notNull(),
  model: text("model").notNull(), series: text("series").notNull(), startNumber: text("start_number").notNull(), endNumber: text("end_number").notNull(),
  statusCode: text("status_code").notNull(), protocol: text("protocol").notNull(), sourceFileHash: text("source_file_hash").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("uq_inutilizations_identity").on(table.environment, table.taxId, table.model, table.series, table.year, table.startNumber, table.endNumber)]);

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(), actorId: text("actor_id").notNull(), entityType: text("entity_type").notNull(), entityId: text("entity_id").notNull(),
  action: text("action").notNull(), beforeJson: text("before_json"), afterJson: text("after_json"), reason: text("reason"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_audit_log_entity").on(table.entityType, table.entityId), index("idx_audit_log_created_at").on(table.createdAt)]);
