import type { PreparedImport } from "./import-pipeline.ts";

export function toPersistenceRows(file: PreparedImport, batchId: string, actorId: string) {
  const storageKey = `originals/${file.hash}/${safeFilename(file.name)}`;
  const base = {
    file: {
      id: `${batchId}:${file.index}:${file.hash}`,
      batchId,
      hash: file.hash,
      originalName: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
      storageKey,
      classification: file.classification,
      outcome: file.status,
      error: file.error ?? null,
      createdBy: actorId,
    },
    items: [] as Array<Record<string, string | number>>,
    document: undefined as Record<string, string | number> | undefined,
    event: undefined as Record<string, string | number> | undefined,
    inutilization: undefined as Record<string, string | number> | undefined,
  };

  if (file.status !== "parsed" || !file.record) return base;

  if (file.record.kind === "nfe") {
    const record = file.record;
    const documentId = `${record.environment}:${record.model}:${record.accessKey}`;
    base.document = {
      id: documentId,
      accessKey: record.accessKey,
      environment: record.environment,
      model: record.model,
      series: record.series,
      number: record.number,
      issueDate: record.issueDate,
      nature: record.nature,
      issuerTaxId: record.issuer.taxId,
      issuerName: record.issuer.name,
      recipientTaxId: record.recipient.taxId,
      recipientName: record.recipient.name,
      totalCents: toCents(record.total),
      fiscalTotalCents: toCents(record.fiscalTotal),
      protocol: record.protocol,
      statusCode: record.statusCode,
      fiscalStatus: "authorized",
      reviewStatus: "pending",
      sourceFileHash: file.hash,
    };
    base.items = record.items.map((item) => ({
      id: `${documentId}:${item.number}`,
      documentId,
      number: item.number,
      code: item.code,
      description: item.description,
      cfop: item.cfop,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      totalCents: toCents(item.total),
    }));
  } else if (file.record.kind === "event") {
    const event = file.record;
    base.event = {
      id: `${event.environment}:${event.accessKey}:${event.eventType}:${event.sequence}`,
      accessKey: event.accessKey,
      environment: event.environment,
      eventType: event.eventType,
      sequence: event.sequence,
      statusCode: event.statusCode,
      protocol: event.protocol,
      registeredAt: event.registeredAt,
      cancelled: event.cancelled ? 1 : 0,
      sourceFileHash: file.hash,
    };
  } else {
    const record = file.record;
    base.inutilization = {
      id: `${record.environment}:${record.taxId}:${record.model}:${record.series}:${record.year}:${record.startNumber}:${record.endNumber}`,
      environment: record.environment,
      taxId: record.taxId,
      year: record.year,
      model: record.model,
      series: record.series,
      startNumber: record.startNumber,
      endNumber: record.endNumber,
      statusCode: record.statusCode,
      protocol: record.protocol,
      sourceFileHash: file.hash,
    };
  }

  return base;
}

function safeFilename(name: string): string {
  const basename = name.split(/[\\/]/).pop() || "arquivo";
  return basename.normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 160) || "arquivo";
}

function toCents(value: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error(`Valor monetário inválido: ${value}.`);
  const [units, decimals = ""] = value.split(".");
  const cents = BigInt(units) * 100n + BigInt(decimals.padEnd(2, "0"));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Valor monetário excede o limite suportado.");
  return Number(cents);
}
