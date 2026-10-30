# Sistema Operacional Financeiro

Aplicação web para transformar documentos fiscais em uma base revisável, com identificação de duplicidades, classificação gerencial e acompanhamento de pendências.

**Projeto de portfólio · base inicial vazia · exemplos fictícios nos testes**

## O problema

Consolidar notas em uma planilha exige distinguir documentos ativos, cancelamentos e arquivos repetidos. Somar valores antes de resolver essas situações pode distorcer o fechamento e dificultar a revisão posterior.

O sistema mantém o documento de origem, separa a situação fiscal da decisão gerencial e apresenta o que ainda precisa ser conferido.

## Funcionalidades

- Importação em lote de XMLs fiscais e PDFs.
- Leitura de NF-e autorizada, eventos de cancelamento e inutilização de numeração.
- Identificação de arquivos repetidos por hash, evitando criar uma segunda linha fiscal para o mesmo conteúdo.
- Encaminhamento de PDFs para revisão assistida, sem tratá-los como XML estruturado.
- Painel com valores documentais, cancelamentos, documentos revisados e pendências.
- Busca e filtros para localizar documentos da base.
- Revisão de categoria e valor gerencial, com controle de versão.
- Exportação em CSV e preservação de metadados dos arquivos de origem.

A interface atual foi desenvolvida em torno de um fechamento mensal de referência. A generalização da experiência para qualquer competência é uma evolução do projeto.

## Fluxo de uso

1. Importar documentos fiscais fictícios.
2. Conferir o resumo de importados, repetidos, rejeitados e pendentes.
3. Abrir os documentos que precisam de classificação.
4. Revisar categoria e valor gerencial, mantendo a situação fiscal separada.
5. Acompanhar os totais e exportar a base revisada.

## Tecnologias e estrutura

| Camada | Implementação |
| --- | --- |
| Interface | React 19, TypeScript e componentes de interface |
| Aplicação e desenvolvimento | Vinext, Vite e convenções de rotas compatíveis com Next.js |
| Persistência | Cloudflare D1 com Drizzle ORM |
| Arquivos | Cloudflare R2 |
| Validação e testes | Zod e Node.js Test Runner |

- `app/`: interface e rotas de importação, consulta, revisão e exportação.
- `lib/`: leitura fiscal, pipeline de importação, revisão e adaptação dos indicadores.
- `db/`: persistência e esquema de dados.
- `drizzle/`: migração SQL do banco.
- `build/` e `scripts/`: integração com o ambiente de execução.

## Executar localmente

Ambiente de testes usado nesta preparação: Node.js 24. Instale as dependências e inicie o desenvolvimento:

```sh
npm install
npm run dev
```

O modo local portátil usa a porta **5173**. A configuração de exemplo em `.openai/hosting.json` contém somente os nomes dos bindings `DB` e `BUCKET`, sem identificador do ambiente original.

As funções de persistência exigem que o ambiente Cloudflare local disponibilize esses bindings e o esquema SQL de `drizzle/`. Para uma implantação própria, configure banco, armazenamento e migrações no destino. Este repositório não conecta automaticamente a base operacional original.

A identidade simulada de desenvolvimento é restrita ao acesso local; a implantação hospedada depende de uma identidade autenticada fornecida pelo ambiente de execução.

## Testes e validação

```sh
node --experimental-strip-types --test lib/*.test.ts db/*.test.ts
npm run build
```

Na preparação desta versão, **21 testes passaram**, cobrindo leitura de documentos, duplicidades, valores em centavos, exportação, revisão, persistência e tratamento da identidade da requisição.

O build completo e a implantação em ambiente novo ainda precisam ser validados. O resultado dos testes não representa integração homologada com um ERP ou fechamento contábil aprovado.

## Decisões de implementação

- Valores monetários são tratados em centavos inteiros nas regras financeiras.
- Hashes identificam o conteúdo importado, não apenas o nome do arquivo.
- Cancelamentos e inutilizações têm tratamento próprio; não são novas vendas.
- XMLs com DTD ou entidades externas são rejeitados.
- A revisão gerencial usa controle de versão para detectar alterações concorrentes.

## Privacidade

A base operacional, planilhas, notas fiscais, documentos importados, estados locais e credenciais não foram incluídos. Os testes usam documentos sintéticos. As configurações de hospedagem foram desvinculadas do ambiente original, e o histórico Git anterior não integra esta distribuição.
