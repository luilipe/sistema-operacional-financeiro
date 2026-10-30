export type DashboardRow = {
  id: string;
  issueDate: string;
  number: string;
  customer: string;
  nature: string;
  amount: number;
  status: "Aprovado" | "Revisar" | "Cancelado";
  source: string;
  revision: number;
};

export type DashboardTotals = {
  documentCount: number;
  grossCents: number;
  cancelledCents: number;
  activeCents: number;
  pendingCount: number;
  pendingCents?: number;
  approvedCount?: number;
  approvedCents?: number;
  cancelledCount?: number;
};

type DocumentsPayload = {
  documents: Array<Record<string, unknown>>;
  totals: DashboardTotals;
};

export function adaptDocumentsPayload(payload: DocumentsPayload): { rows: DashboardRow[]; totals: DashboardTotals } {
  return {
    rows: payload.documents.map((doc) => ({
      id: String(doc.id),
      issueDate: formatFiscalDate(String(doc.issueDate)),
      number: String(doc.number),
      customer: String(doc.recipientName),
      nature: String(doc.nature),
      amount: Number(doc.totalCents) / 100,
      status: doc.fiscalStatus === "cancelled" ? "Cancelado" : doc.reviewStatus === "approved" ? "Aprovado" : "Revisar",
      source: "XML preservado",
      revision: Number(doc.revision),
    })),
    totals: payload.totals,
  };
}

function formatFiscalDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}
