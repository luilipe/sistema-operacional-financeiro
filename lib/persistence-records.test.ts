import test from "node:test";
import assert from "node:assert/strict";
import { toPersistenceRows } from "./persistence-records.ts";
import type { PreparedImport } from "./import-pipeline.ts";

const hash = "a".repeat(64);
const key = "31260812345678000123550010000076061000076066";
const prepared: PreparedImport = {
  index: 0, name: "../NF-e 7606.xml", type: "application/xml", size: 10, hash,
  classification: "nfe", status: "parsed",
  record: {
    kind: "nfe", accessKey: key, model: "55", series: "1", number: "7606", environment: "1",
    issueDate: "2026-08-21T10:20:00-03:00", nature: "VENDA", issuer: { taxId: "1", name: "OURO FINO" },
    recipient: { taxId: "2", name: "CLIENTE" }, total: "10.50", fiscalTotal: "10.50", protocol: "10",
    statusCode: "100", cfops: ["5101"], items: [{ number: 1, code: "A", description: "PRODUTO", cfop: "5101", quantity: "1.0000", unit: "UN", unitPrice: "10.50", total: "10.50" }], installments: [],
  },
};

test("creates stable persistence rows with integer cents and a safe storage key", () => {
  const result = toPersistenceRows(prepared, "batch-1", "user-1");
  assert.equal(result.file.storageKey, `originals/${hash}/NF-e_7606.xml`);
  assert.deepEqual(result.document, {
    id: `1:55:${key}`, accessKey: key, environment: "1", model: "55", series: "1", number: "7606",
    issueDate: "2026-08-21T10:20:00-03:00", nature: "VENDA", issuerTaxId: "1", issuerName: "OURO FINO",
    recipientTaxId: "2", recipientName: "CLIENTE", totalCents: 1050, fiscalTotalCents: 1050,
    protocol: "10", statusCode: "100", fiscalStatus: "authorized", reviewStatus: "pending", sourceFileHash: hash,
  });
  assert.equal(result.items[0].totalCents, 1050);
});

test("duplicate inputs create file metadata but no second fiscal row", () => {
  const duplicate = toPersistenceRows({ ...prepared, status: "duplicate" }, "batch-2", "user-1");
  assert.equal(duplicate.file.outcome, "duplicate");
  assert.equal(duplicate.document, undefined);
  assert.deepEqual(duplicate.items, []);
});
