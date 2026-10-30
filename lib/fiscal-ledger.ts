import type { FiscalEvent, FiscalXml, Inutilization, NfeDocument } from "./nfe-parser.ts";

export type ReconciledDocument = NfeDocument & {
  fiscalStatus: "authorized" | "cancelled";
  events: FiscalEvent[];
};

export type FiscalLedger = {
  documents: ReconciledDocument[];
  pendingEvents: FiscalEvent[];
  inutilizations: Inutilization[];
  totals: { gross: string; cancelled: string; active: string };
};

export function reconcileFiscalRecords(records: FiscalXml[]): FiscalLedger {
  const noteMap = new Map<string, ReconciledDocument>();
  const eventMap = new Map<string, FiscalEvent>();
  const inutilizationMap = new Map<string, Inutilization>();

  for (const record of records) {
    if (record.kind === "nfe") {
      const id = `${record.environment}:${record.model}:${record.accessKey}`;
      if (!noteMap.has(id)) noteMap.set(id, { ...record, fiscalStatus: "authorized", events: [] });
      continue;
    }
    if (record.kind === "event") {
      const id = `${record.environment}:${record.accessKey}:${record.eventType}:${record.sequence}`;
      if (!eventMap.has(id)) eventMap.set(id, record);
      continue;
    }
    const id = `${record.environment}:${record.taxId}:${record.model}:${record.series}:${record.year}:${record.startNumber}:${record.endNumber}`;
    if (!inutilizationMap.has(id)) inutilizationMap.set(id, record);
  }

  const pendingEvents: FiscalEvent[] = [];
  for (const event of eventMap.values()) {
    const note = [...noteMap.values()].find((candidate) => candidate.environment === event.environment && candidate.accessKey === event.accessKey);
    if (!note) {
      pendingEvents.push(event);
      continue;
    }
    note.events.push(event);
    if (event.cancelled) note.fiscalStatus = "cancelled";
  }

  const documents = [...noteMap.values()];
  const grossCents = sumCents(documents.map((document) => document.total));
  const cancelledCents = sumCents(documents.filter((document) => document.fiscalStatus === "cancelled").map((document) => document.total));

  return {
    documents,
    pendingEvents,
    inutilizations: [...inutilizationMap.values()],
    totals: {
      gross: centsToMoney(grossCents),
      cancelled: centsToMoney(cancelledCents),
      active: centsToMoney(grossCents - cancelledCents),
    },
  };
}

function sumCents(values: string[]): bigint {
  return values.reduce((sum, value) => sum + moneyToCents(value), 0n);
}

function moneyToCents(value: string): bigint {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error(`Valor monetário inválido: ${value}.`);
  const [units, decimals = ""] = value.split(".");
  return BigInt(units) * 100n + BigInt(decimals.padEnd(2, "0"));
}

function centsToMoney(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}
