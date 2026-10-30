import test from "node:test";
import assert from "node:assert/strict";
import { validateReviewInput } from "./review.ts";

test("normalizes an approved managerial classification", () => {
  assert.deepEqual(validateReviewInput({ documentId: "1:55:key", category: "  VENDAS  ", managerialValueCents: 1050, revision: 2, reason: "Conferido com o XML" }), {
    documentId: "1:55:key", category: "VENDAS", managerialValueCents: 1050, revision: 2, reason: "Conferido com o XML",
  });
});

test("rejects incomplete or non-integer review data", () => {
  assert.throws(() => validateReviewInput({ documentId: "", category: "", managerialValueCents: 10.5, revision: 0 }), /Revisão inválida/);
});
