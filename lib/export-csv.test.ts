import test from "node:test";
import assert from "node:assert/strict";
import { buildDocumentCsv } from "./export-csv.ts";

test("exports numeric cents, traceability fields and neutralizes formulas", () => {
  const csv = buildDocumentCsv([{
    issueDate: "2026-08-21T10:20:00-03:00", recipientName: "=HYPERLINK(\"x\")", totalCents: 1050,
    managerialValueCents: 1000, managerialCategory: "VENDAS", number: "7606", series: "1", accessKey: "3126",
    fiscalStatus: "authorized", reviewStatus: "approved",
  }]);
  assert.equal(csv, "\uFEFFData de emissão;Cliente;Valor documental;Valor gerencial;Categoria;Número;Série;Chave;Situação fiscal;Revisão\r\n21/08/2026;\"'=HYPERLINK(\"\"x\"\")\";10,50;10,00;VENDAS;7606;1;3126;authorized;approved\r\n");
});

test("leaves missing managerial approval blank", () => {
  const csv = buildDocumentCsv([{ issueDate: "2026-08-01", recipientName: "Cliente", totalCents: 500, managerialValueCents: null, managerialCategory: null, number: "1", series: "1", accessKey: "k", fiscalStatus: "cancelled", reviewStatus: "pending" }]);
  assert.match(csv, /;5,00;;;1;1;k;cancelled;pending/);
});
