export type ExportDocument = {
  issueDate: string;
  recipientName: string;
  totalCents: number;
  managerialValueCents: number | null;
  managerialCategory: string | null;
  number: string;
  series: string;
  accessKey: string;
  fiscalStatus: string;
  reviewStatus: string;
};

const headers = ["Data de emissão", "Cliente", "Valor documental", "Valor gerencial", "Categoria", "Número", "Série", "Chave", "Situação fiscal", "Revisão"];

export function buildDocumentCsv(documents: ExportDocument[]): string {
  const rows = documents.map((document) => [
    formatDate(document.issueDate),
    document.recipientName,
    formatCents(document.totalCents),
    document.managerialValueCents == null ? "" : formatCents(document.managerialValueCents),
    document.managerialCategory ?? "",
    document.number,
    document.series,
    document.accessKey,
    document.fiscalStatus,
    document.reviewStatus,
  ]);
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
}

function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatCents(value: number): string {
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  return `${sign}${Math.trunc(absolute / 100)},${String(absolute % 100).padStart(2, "0")}`;
}

function csvCell(raw: string): string {
  const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[;"\r\n]/.test(neutralized) ? `"${neutralized.replace(/"/g, '""')}"` : neutralized;
}
