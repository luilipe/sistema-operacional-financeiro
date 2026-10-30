import test from "node:test";
import assert from "node:assert/strict";
import { parseFiscalXml } from "./nfe-parser.ts";

const accessKey = "31260812345678000123550010000076061000076066";

test("parses an authorized NF-e without counting its total per item", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
    <NFe><infNFe Id="NFe${accessKey}" versao="4.00">
      <ide><cUF>31</cUF><natOp>VENDA DE PRODUCAO</natOp><mod>55</mod><serie>1</serie><nNF>7606</nNF><dhEmi>2026-08-21T10:20:00-03:00</dhEmi><tpAmb>1</tpAmb></ide>
      <emit><CNPJ>00040151045200</CNPJ><xNome>OURO FINO TECNOLOGIAS AMBIENTAIS</xNome></emit>
      <dest><CNPJ>00025116256900</CNPJ><xNome>COPASA MG</xNome></dest>
      <det nItem="1"><prod><cProd>A1</cProd><xProd>PRODUTO A</xProd><CFOP>5101</CFOP><qCom>2.0000</qCom><uCom>UN</uCom><vUnCom>1000.00</vUnCom><vProd>2000.00</vProd></prod></det>
      <det nItem="2"><prod><cProd>B2</cProd><xProd>PRODUTO B</xProd><CFOP>5949</CFOP><qCom>1.0000</qCom><uCom>UN</uCom><vUnCom>180.00</vUnCom><vProd>180.00</vProd></prod></det>
      <total><ICMSTot><vNF>2180.00</vNF></ICMSTot><IBSCBSTot><vNFTot>2180.00</vNFTot></IBSCBSTot></total>
      <cobr><dup><nDup>001</nDup><dVenc>2026-09-20</dVenc><vDup>2180.00</vDup></dup></cobr>
    </infNFe></NFe>
    <protNFe><infProt><chNFe>${accessKey}</chNFe><dhRecbto>2026-08-21T10:21:00-03:00</dhRecbto><nProt>131260000000001</nProt><cStat>100</cStat></infProt></protNFe>
  </nfeProc>`;

  const parsed = parseFiscalXml(xml);

  assert.deepEqual(parsed, {
    kind: "nfe",
    accessKey,
    model: "55",
    series: "1",
    number: "7606",
    environment: "1",
    issueDate: "2026-08-21T10:20:00-03:00",
    nature: "VENDA DE PRODUCAO",
    issuer: { taxId: "00040151045200", name: "OURO FINO TECNOLOGIAS AMBIENTAIS" },
    recipient: { taxId: "00025116256900", name: "COPASA MG" },
    total: "2180.00",
    fiscalTotal: "2180.00",
    protocol: "131260000000001",
    statusCode: "100",
    cfops: ["5101", "5949"],
    items: [
      { number: 1, code: "A1", description: "PRODUTO A", cfop: "5101", quantity: "2.0000", unit: "UN", unitPrice: "1000.00", total: "2000.00" },
      { number: 2, code: "B2", description: "PRODUTO B", cfop: "5949", quantity: "1.0000", unit: "UN", unitPrice: "180.00", total: "180.00" },
    ],
    installments: [{ number: "001", dueDate: "2026-09-20", amount: "2180.00" }],
  });
});

test("parses a homologated cancellation event independently of note order", () => {
  const xml = `<procEventoNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><evento><infEvento Id="ID110111${accessKey}01"><cOrgao>31</cOrgao><tpAmb>1</tpAmb><CNPJ>00040151045200</CNPJ><chNFe>${accessKey}</chNFe><dhEvento>2026-08-22T09:00:00-03:00</dhEvento><tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento><detEvento><nProt>131260000000001</nProt><xJust>OPERACAO NAO REALIZADA</xJust></detEvento></infEvento></evento><retEvento><infEvento><tpAmb>1</tpAmb><cOrgao>31</cOrgao><cStat>135</cStat><chNFe>${accessKey}</chNFe><tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento><nProt>131260000000099</nProt><dhRegEvento>2026-08-22T09:00:03-03:00</dhRegEvento></infEvento></retEvento></procEventoNFe>`;
  assert.deepEqual(parseFiscalXml(xml), {
    kind: "event",
    eventType: "110111",
    accessKey,
    environment: "1",
    sequence: "1",
    statusCode: "135",
    protocol: "131260000000099",
    registeredAt: "2026-08-22T09:00:03-03:00",
    cancelled: true,
  });
});

test("parses an approved inutilization range without creating a note", () => {
  const xml = `<ProcInutNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><inutNFe><infInut Id="ID312612345678000123550010000766400007664"><tpAmb>1</tpAmb><xServ>INUTILIZAR</xServ><cUF>31</cUF><ano>26</ano><CNPJ>00040151045200</CNPJ><mod>55</mod><serie>1</serie><nNFIni>7664</nNFIni><nNFFin>7664</nNFFin><xJust>QUEBRA DE SEQUENCIA</xJust></infInut></inutNFe><retInutNFe><infInut><tpAmb>1</tpAmb><cStat>102</cStat><ano>26</ano><CNPJ>00040151045200</CNPJ><mod>55</mod><serie>1</serie><nNFIni>7664</nNFIni><nNFFin>7664</nNFFin><nProt>131260000000222</nProt></infInut></retInutNFe></ProcInutNFe>`;
  assert.deepEqual(parseFiscalXml(xml), { kind: "inutilization", environment: "1", taxId: "00040151045200", year: "26", model: "55", series: "1", startNumber: "7664", endNumber: "7664", statusCode: "102", protocol: "131260000000222" });
});

test("rejects XML declarations that can resolve external entities", () => {
  assert.throws(() => parseFiscalXml(`<!DOCTYPE x [<!ENTITY ext SYSTEM "file:///etc/passwd">]><x>&ext;</x>`), /DTD e entidades não são permitidos/);
});
