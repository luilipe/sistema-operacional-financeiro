# Sistema Operacional Financeiro

Versão para GitHub com exemplos fictícios. Nenhum banco, laudo, planilha operacional, arquivo importado ou histórico Git anterior foi incluído.

As pastas originais usadas na operação foram preservadas. Credenciais devem ser configuradas apenas localmente.

## Desenvolvimento local

```sh
npm install
npm run dev
```

Aplicação baseada em React/Vinext e Cloudflare D1/R2. Os bindings locais `DB` e `BUCKET` estão em `.openai/hosting.json`, sem vínculo com a hospedagem original. O banco inicia vazio. Importe apenas documentos fictícios nesta cópia. Nenhuma base Cloudflare, NF ou planilha original foi incluída.

```sh
node --experimental-strip-types --test lib/*.test.ts db/*.test.ts
```

## Distribuição para GitHub

Esta cópia foi preparada com dados fictícios, sem arquivos de produção ou histórico Git anterior. Os cadastros, responsáveis, identificadores e referências a espaços privados foram substituídos; os documentos originais de clientes e os testes que dependem deles não integram esta distribuição. As pastas originais foram preservadas.

Os testes locais foram executados com as dependências já instaladas na máquina. A validação completa de build, serviços e hospedagem em ambiente novo permanece pendente.
