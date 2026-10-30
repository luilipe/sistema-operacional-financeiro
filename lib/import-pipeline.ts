import { parseFiscalXml, type FiscalXml } from "./nfe-parser.ts";

export type ImportInput = { name: string; type: string; bytes: Uint8Array };
export type PreparedImport = {
  index: number;
  name: string;
  type: string;
  size: number;
  hash: string;
  classification: FiscalXml["kind"] | "pdf" | "unsupported";
  status: "parsed" | "pending" | "duplicate" | "rejected";
  record?: FiscalXml;
  error?: string;
};

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export async function prepareImport(files: ImportInput[]): Promise<PreparedImport[]> {
  const seen = new Map<string, PreparedImport["classification"]>();
  const prepared: PreparedImport[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const hash = await hashBytes(file.bytes);
    const base = { index, name: file.name, type: file.type, size: file.bytes.byteLength, hash };

    const previousClassification = seen.get(hash);
    if (previousClassification) {
      prepared.push({ ...base, classification: previousClassification, status: "duplicate" });
      continue;
    }

    if (file.bytes.byteLength > MAX_FILE_BYTES) {
      prepared.push({ ...base, classification: "unsupported", status: "rejected", error: "Arquivo excede o limite de 20 MB." });
      seen.set(hash, "unsupported");
      continue;
    }
    if (sniffPdf(file.bytes)) {
      prepared.push({ ...base, classification: "pdf", status: "pending" });
      seen.set(hash, "pdf");
      continue;
    }

    try {
      const xml = new TextDecoder("utf-8", { fatal: true }).decode(file.bytes);
      const record = parseFiscalXml(xml);
      prepared.push({ ...base, classification: record.kind, status: "parsed", record });
      seen.set(hash, record.kind);
    } catch (error) {
      prepared.push({
        ...base,
        classification: "unsupported",
        status: "rejected",
        error: error instanceof Error ? error.message : "Não foi possível interpretar o arquivo.",
      });
      seen.set(hash, "unsupported");
    }
  }

  return prepared;
}

export async function hashBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

export function looksLikeImportDocument(bytes: Uint8Array): boolean {
  if (sniffPdf(bytes)) return true;
  const prefix = new TextDecoder("utf-8").decode(bytes.subarray(0, 512)).trimStart();
  return prefix.startsWith("<");
}

function sniffPdf(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 5 && new TextDecoder("ascii").decode(bytes.subarray(0, 5)) === "%PDF-";
}
