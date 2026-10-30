import test from "node:test";
import assert from "node:assert/strict";
import { approveDocumentReview } from "./fiscal-store.ts";

test("approval and its audit entry are committed in one database batch", async () => {
  const batches: FakeStatement[][] = [];
  const before = {
    id: "doc-1",
    fiscalStatus: "active",
    reviewStatus: "pending",
    managerialCategory: null,
    managerialValueCents: null,
    revision: 1,
  };

  class FakeStatement {
    args: unknown[] = [];
    readonly sql: string;
    constructor(sql: string) { this.sql = sql; }
    bind(...args: unknown[]) { this.args = args; return this; }
    async first() { return this.sql.startsWith("SELECT id") ? before : null; }
    async run(): Promise<never> { throw new Error("review writes must use an atomic batch"); }
  }

  const db = {
    prepare(sql: string) { return new FakeStatement(sql); },
    async batch(statements: FakeStatement[]) {
      batches.push(statements);
      return [{ meta: { changes: 1 } }, { meta: { changes: 1 } }];
    },
  };

  const result = await approveDocumentReview(db as unknown as D1Database, {
    documentId: "doc-1",
    category: "VENDAS",
    managerialValueCents: 1000,
    revision: 1,
    reason: "Conferido",
  }, "user-1");

  assert.deepEqual(result, { outcome: "approved", revision: 2 });
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 2);
  assert.match(batches[0][1].sql, /WHERE changes\(\)=1/);
});
