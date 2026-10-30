import test from "node:test";
import assert from "node:assert/strict";
import { reconcileFiscalRecords } from "./fiscal-ledger.ts";
import type { FiscalXml } from "./nfe-parser.ts";

const key = "31260812345678000123550010000076061000076066";
const note: FiscalXml = {
  kind: "nfe", accessKey: key, model: "55", series: "1", number: "7606", environment: "1",
  issueDate: "2026-08-21T10:20:00-03:00", nature: "VENDA", issuer: { taxId: "1", name: "OURO FINO" },
  recipient: { taxId: "2", name: "CLIENTE" }, total: "2180.00", fiscalTotal: "2180.00", protocol: "10",
  statusCode: "100", cfops: ["5101"], items: [], installments: [],
};
const cancellation: FiscalXml = {
  kind: "event", eventType: "110111", accessKey: key, environment: "1", sequence: "1", statusCode: "135",
  protocol: "20", registeredAt: "2026-08-22T09:00:03-03:00", cancelled: true,
};
const inutilization: FiscalXml = {
  kind: "inutilization", environment: "1", taxId: "1", year: "26", model: "55", series: "1",
  startNumber: "7664", endNumber: "7664", statusCode: "102", protocol: "30",
};

test("reimport and reversed event order produce one cancelled document", () => {
  const result = reconcileFiscalRecords([cancellation, note, note, cancellation]);
  assert.equal(result.documents.length, 1);
  assert.equal(result.documents[0].fiscalStatus, "cancelled");
  assert.equal(result.documents[0].events.length, 1);
  assert.equal(result.pendingEvents.length, 0);
  assert.deepEqual(result.totals, { gross: "2180.00", cancelled: "2180.00", active: "0.00" });
});

test("keeps an event pending when its note is not in the batch", () => {
  const result = reconcileFiscalRecords([cancellation, inutilization]);
  assert.equal(result.documents.length, 0);
  assert.deepEqual(result.pendingEvents, [cancellation]);
  assert.deepEqual(result.inutilizations, [inutilization]);
});
