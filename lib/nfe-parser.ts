export type FiscalXml = NfeDocument | FiscalEvent | Inutilization;

export type NfeItem = {
  number: number;
  code: string;
  description: string;
  cfop: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  total: string;
};

export type NfeDocument = {
  kind: "nfe";
  accessKey: string;
  model: string;
  series: string;
  number: string;
  environment: string;
  issueDate: string;
  nature: string;
  issuer: { taxId: string; name: string };
  recipient: { taxId: string; name: string };
  total: string;
  fiscalTotal: string;
  protocol: string;
  statusCode: string;
  cfops: string[];
  items: NfeItem[];
  installments: Array<{ number: string; dueDate: string; amount: string }>;
};

export type FiscalEvent = {
  kind: "event";
  eventType: string;
  accessKey: string;
  environment: string;
  sequence: string;
  statusCode: string;
  protocol: string;
  registeredAt: string;
  cancelled: boolean;
};

export type Inutilization = {
  kind: "inutilization";
  environment: string;
  taxId: string;
  year: string;
  model: string;
  series: string;
  startNumber: string;
  endNumber: string;
  statusCode: string;
  protocol: string;
};

export function parseFiscalXml(xml: string): FiscalXml {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new Error("DTD e entidades não são permitidos em XML fiscal.");
  }
  if (/<(?:\w+:)?nfeProc\b/i.test(xml)) return parseNfe(xml);
  if (/<(?:\w+:)?procEventoNFe\b/i.test(xml)) return parseEvent(xml);
  if (/<(?:\w+:)?ProcInutNFe\b/i.test(xml)) return parseInutilization(xml);
  throw new Error("Formato de XML fiscal não suportado.");
}

function parseNfe(xml: string): NfeDocument {
  const info = requiredSection(xml, "infNFe");
  const infoAttributes = firstOpenTagAttributes(xml, "infNFe");
  const protocolInfo = requiredSection(xml, "infProt");
  const issuer = requiredSection(info, "emit");
  const recipient = requiredSection(info, "dest");
  const ibsCbs = section(info, "IBSCBSTot");
  const items = sections(info, "det").map(({ attributes, content }, index) => {
    const product = requiredSection(content, "prod");
    return {
      number: Number(attribute(attributes, "nItem") || index + 1),
      code: requiredTag(product, "cProd"),
      description: requiredTag(product, "xProd"),
      cfop: requiredTag(product, "CFOP"),
      quantity: requiredTag(product, "qCom"),
      unit: requiredTag(product, "uCom"),
      unitPrice: requiredTag(product, "vUnCom"),
      total: requiredTag(product, "vProd"),
    };
  });
  const installments = sections(info, "dup").map(({ content }) => ({
    number: requiredTag(content, "nDup"),
    dueDate: requiredTag(content, "dVenc"),
    amount: requiredTag(content, "vDup"),
  }));
  const total = requiredTag(requiredSection(info, "ICMSTot"), "vNF");
  const keyFromId = attribute(infoAttributes, "Id").replace(/^NFe/, "");

  return {
    kind: "nfe",
    accessKey: tag(protocolInfo, "chNFe") || requiredValue(keyFromId, "chave de acesso"),
    model: requiredTag(info, "mod"),
    series: requiredTag(info, "serie"),
    number: requiredTag(info, "nNF"),
    environment: requiredTag(info, "tpAmb"),
    issueDate: requiredTag(info, "dhEmi"),
    nature: requiredTag(info, "natOp"),
    issuer: { taxId: taxId(issuer), name: requiredTag(issuer, "xNome") },
    recipient: { taxId: taxId(recipient), name: requiredTag(recipient, "xNome") },
    total,
    fiscalTotal: tag(ibsCbs, "vNFTot") || total,
    protocol: requiredTag(protocolInfo, "nProt"),
    statusCode: requiredTag(protocolInfo, "cStat"),
    cfops: [...new Set(items.map((item) => item.cfop))],
    items,
    installments,
  };
}

function parseEvent(xml: string): FiscalEvent {
  const returned = requiredSection(requiredSection(xml, "retEvento"), "infEvento");
  const statusCode = requiredTag(returned, "cStat");
  return {
    kind: "event",
    eventType: requiredTag(returned, "tpEvento"),
    accessKey: requiredTag(returned, "chNFe"),
    environment: requiredTag(returned, "tpAmb"),
    sequence: requiredTag(returned, "nSeqEvento"),
    statusCode,
    protocol: requiredTag(returned, "nProt"),
    registeredAt: requiredTag(returned, "dhRegEvento"),
    cancelled: requiredTag(returned, "tpEvento") === "110111" && ["135", "136", "155"].includes(statusCode),
  };
}

function parseInutilization(xml: string): Inutilization {
  const returned = requiredSection(requiredSection(xml, "retInutNFe"), "infInut");
  return {
    kind: "inutilization",
    environment: requiredTag(returned, "tpAmb"),
    taxId: taxId(returned),
    year: requiredTag(returned, "ano"),
    model: requiredTag(returned, "mod"),
    series: requiredTag(returned, "serie"),
    startNumber: requiredTag(returned, "nNFIni"),
    endNumber: requiredTag(returned, "nNFFin"),
    statusCode: requiredTag(returned, "cStat"),
    protocol: requiredTag(returned, "nProt"),
  };
}

function taxId(xml: string): string {
  return tag(xml, "CNPJ") || tag(xml, "CPF") || "";
}

function tag(xml: string, name: string): string {
  const escaped = escapeRegExp(name);
  const match = xml.match(new RegExp(`<(?:\\w+:)?${escaped}\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${escaped}>`, "i"));
  return match ? decodeXml(match[1].trim()) : "";
}

function requiredTag(xml: string, name: string): string {
  return requiredValue(tag(xml, name), name);
}

function section(xml: string, name: string): string {
  const escaped = escapeRegExp(name);
  return xml.match(new RegExp(`<(?:\\w+:)?${escaped}\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${escaped}>`, "i"))?.[1] ?? "";
}

function requiredSection(xml: string, name: string): string {
  return requiredValue(section(xml, name), name);
}

function sections(xml: string, name: string): Array<{ attributes: string; content: string }> {
  const escaped = escapeRegExp(name);
  const expression = new RegExp(`<(?:\\w+:)?${escaped}\\b([^>]*)>([\\s\\S]*?)<\\/(?:\\w+:)?${escaped}>`, "gi");
  return [...xml.matchAll(expression)].map((match) => ({ attributes: match[1], content: match[2] }));
}

function firstOpenTagAttributes(xml: string, name: string): string {
  const escaped = escapeRegExp(name);
  return xml.match(new RegExp(`<(?:\\w+:)?${escaped}\\b([^>]*)>`, "i"))?.[1] ?? "";
}

function attribute(attributes: string, name: string): string {
  const escaped = escapeRegExp(name);
  return decodeXml(attributes.match(new RegExp(`\\b${escaped}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? "");
}

function requiredValue(value: string, field: string): string {
  if (!value) throw new Error(`Campo obrigatório ausente: ${field}.`);
  return value;
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
