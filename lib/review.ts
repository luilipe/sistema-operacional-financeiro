export type ReviewInput = { documentId: string; category: string; managerialValueCents: number; revision: number; reason: string };

export function validateReviewInput(value: unknown): ReviewInput {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const documentId = typeof input.documentId === "string" ? input.documentId.trim() : "";
  const category = typeof input.category === "string" ? input.category.trim() : "";
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  const managerialValueCents = input.managerialValueCents;
  const revision = input.revision;
  if (!documentId || !category || category.length > 80 || !Number.isSafeInteger(managerialValueCents) || !Number.isInteger(revision) || Number(revision) < 1 || reason.length > 500) {
    throw new Error("Revisão inválida. Verifique categoria, valor e versão do documento.");
  }
  return { documentId, category, managerialValueCents: Number(managerialValueCents), revision: Number(revision), reason };
}
