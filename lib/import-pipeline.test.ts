import test from "node:test";
import assert from "node:assert/strict";
import { hashBytes, looksLikeImportDocument, prepareImport } from "./import-pipeline.ts";

const encoder = new TextEncoder();
const key = "31260812345678000123550010000076061000076066";
const noteXml = `<nfeProc><NFe><infNFe Id="NFe${key}"><ide><natOp>VENDA</natOp><mod>55</mod><serie>1</serie><nNF>7606</nNF><dhEmi>2026-08-21T10:20:00-03:00</dhEmi><tpAmb>1</tpAmb></ide><emit><CNPJ>1</CNPJ><xNome>OURO FINO</xNome></emit><dest><CNPJ>2</CNPJ><xNome>CLIENTE</xNome></dest><det nItem="1"><prod><cProd>A</cProd><xProd>PRODUTO</xProd><CFOP>5101</CFOP><qCom>1.0000</qCom><uCom>UN</uCom><vUnCom>10.00</vUnCom><vProd>10.00</vProd></prod></det><total><ICMSTot><vNF>10.00</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><chNFe>${key}</chNFe><nProt>10</nProt><cStat>100</cStat></infProt></protNFe></nfeProc>`;

test("SHA-256 is stable for immutable original identification", async () => {
  assert.equal(await hashBytes(encoder.encode("abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("prepares fiscal XML and marks a byte-identical reupload as duplicate", async () => {
  const bytes = encoder.encode(noteXml);
  const result = await prepareImport([
    { name: "nfe-7606.xml", type: "application/xml", bytes },
    { name: "copia.xml", type: "text/xml", bytes },
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[0].classification, "nfe");
  assert.equal(result[0].status, "parsed");
  assert.equal(result[0].record?.kind, "nfe");
  assert.equal(result[1].status, "duplicate");
  assert.equal(result[1].classification, "nfe");
  assert.equal(result[1].hash, result[0].hash);
});

test("keeps PDF for assisted review and rejects unsafe XML", async () => {
  const result = await prepareImport([
    { name: "danfe.pdf", type: "application/pdf", bytes: encoder.encode("%PDF-1.7") },
    { name: "unsafe.xml", type: "application/xml", bytes: encoder.encode(`<!DOCTYPE x [<!ENTITY e SYSTEM "file:///tmp/a">]><x>&e;</x>`) },
  ]);
  assert.deepEqual(result.map(({ classification, status }) => ({ classification, status })), [
    { classification: "pdf", status: "pending" },
    { classification: "unsupported", status: "rejected" },
  ]);
  assert.match(result[1].error ?? "", /DTD e entidades não são permitidos/);
});

test("accepts document signatures and blocks executable binary content", () => {
  assert.equal(looksLikeImportDocument(encoder.encode("%PDF-1.7")), true);
  assert.equal(looksLikeImportDocument(encoder.encode("  <?xml version=\"1.0\"?><NFe/>")), true);
  assert.equal(looksLikeImportDocument(Uint8Array.from([0x4d, 0x5a, 0x90, 0, 3])), false);
});
