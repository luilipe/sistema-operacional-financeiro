CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_log_entity` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_log_created_at` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `fiscal_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`access_key` text NOT NULL,
	`environment` text NOT NULL,
	`model` text NOT NULL,
	`series` text NOT NULL,
	`number` text NOT NULL,
	`issue_date` text NOT NULL,
	`nature` text NOT NULL,
	`issuer_tax_id` text NOT NULL,
	`issuer_name` text NOT NULL,
	`recipient_tax_id` text NOT NULL,
	`recipient_name` text NOT NULL,
	`total_cents` integer NOT NULL,
	`fiscal_total_cents` integer NOT NULL,
	`protocol` text NOT NULL,
	`status_code` text NOT NULL,
	`fiscal_status` text DEFAULT 'authorized' NOT NULL,
	`review_status` text DEFAULT 'pending' NOT NULL,
	`managerial_category` text,
	`managerial_value_cents` integer,
	`reviewed_by` text,
	`reviewed_at` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`source_file_hash` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_fiscal_documents_identity` ON `fiscal_documents` (`environment`,`model`,`access_key`);--> statement-breakpoint
CREATE INDEX `idx_fiscal_documents_issue_date` ON `fiscal_documents` (`issue_date`);--> statement-breakpoint
CREATE INDEX `idx_fiscal_documents_review_status` ON `fiscal_documents` (`review_status`);--> statement-breakpoint
CREATE TABLE `fiscal_events` (
	`id` text PRIMARY KEY NOT NULL,
	`access_key` text NOT NULL,
	`environment` text NOT NULL,
	`event_type` text NOT NULL,
	`sequence` text NOT NULL,
	`status_code` text NOT NULL,
	`protocol` text NOT NULL,
	`registered_at` text NOT NULL,
	`cancelled` integer DEFAULT false NOT NULL,
	`source_file_hash` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_fiscal_events_identity` ON `fiscal_events` (`environment`,`access_key`,`event_type`,`sequence`);--> statement-breakpoint
CREATE INDEX `idx_fiscal_events_access_key` ON `fiscal_events` (`access_key`);--> statement-breakpoint
CREATE TABLE `fiscal_items` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`number` integer NOT NULL,
	`code` text NOT NULL,
	`description` text NOT NULL,
	`cfop` text NOT NULL,
	`quantity` text NOT NULL,
	`unit` text NOT NULL,
	`unit_price` text NOT NULL,
	`total_cents` integer NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `fiscal_documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_fiscal_items_document_number` ON `fiscal_items` (`document_id`,`number`);--> statement-breakpoint
CREATE INDEX `idx_fiscal_items_cfop` ON `fiscal_items` (`cfop`);--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`file_count` integer DEFAULT 0 NOT NULL,
	`imported_count` integer DEFAULT 0 NOT NULL,
	`pending_count` integer DEFAULT 0 NOT NULL,
	`rejected_count` integer DEFAULT 0 NOT NULL,
	`duplicate_count` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_import_batches_created_at` ON `import_batches` (`created_at`);--> statement-breakpoint
CREATE TABLE `inutilizations` (
	`id` text PRIMARY KEY NOT NULL,
	`environment` text NOT NULL,
	`tax_id` text NOT NULL,
	`year` text NOT NULL,
	`model` text NOT NULL,
	`series` text NOT NULL,
	`start_number` text NOT NULL,
	`end_number` text NOT NULL,
	`status_code` text NOT NULL,
	`protocol` text NOT NULL,
	`source_file_hash` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_inutilizations_identity` ON `inutilizations` (`environment`,`tax_id`,`model`,`series`,`year`,`start_number`,`end_number`);--> statement-breakpoint
CREATE TABLE `original_files` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`hash` text NOT NULL,
	`original_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`storage_key` text NOT NULL,
	`classification` text NOT NULL,
	`outcome` text NOT NULL,
	`error` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `import_batches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_original_files_batch_id` ON `original_files` (`batch_id`);--> statement-breakpoint
CREATE INDEX `idx_original_files_hash` ON `original_files` (`hash`);