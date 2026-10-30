import test from "node:test";
import assert from "node:assert/strict";
import { adaptDocumentsPayload } from "./dashboard-data.ts";

test("an empty persisted result replaces demonstration rows with an empty ledger", () => {
  const result = adaptDocumentsPayload({
    documents: [],
    totals: { documentCount: 0, grossCents: 0, cancelledCents: 0, activeCents: 0, pendingCount: 0 },
  });

  assert.deepEqual(result.rows, []);
  assert.equal(result.totals.documentCount, 0);
});

test("maps persisted fiscal state to the operational ledger", () => {
  const result = adaptDocumentsPayload({
    documents: [{
      id: "doc-1",
      issueDate: "2026-08-21T10:20:00-03:00",
      number: "7606",
      recipientName: "CLIENTE",
      nature: "VENDA",
      totalCents: 12345,
      fiscalStatus: "active",
      reviewStatus: "approved",
      revision: 2,
    }],
    totals: { documentCount: 1, grossCents: 12345, cancelledCents: 0, activeCents: 12345, pendingCount: 0 },
  });

  assert.equal(result.rows[0].status, "Aprovado");
  assert.equal(result.rows[0].amount, 123.45);
  assert.equal(result.rows[0].revision, 2);
});
