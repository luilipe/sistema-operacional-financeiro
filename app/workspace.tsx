"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowUpRight, CheckCircle2, ChevronRight, CircleDollarSign, Download, FileSearch, FileText, Filter, LayoutDashboard, ListChecks, Menu, ReceiptText, RotateCcw, Search, Settings2, ShieldCheck, UploadCloud, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adaptDocumentsPayload, type DashboardRow as Row, type DashboardTotals } from "@/lib/dashboard-data";

type WebMcpContext = { registerTool: (tool: { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: unknown) => unknown | Promise<unknown> }, options?: { signal?: AbortSignal }) => void | Promise<void> };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function Status({ value }: { value: Row["status"] }) {
  const tone = value === "Aprovado" ? "approved" : value === "Cancelado" ? "cancelled" : "review";
  return <span className={`status ${tone}`}>{value}</span>;
}

export function FinanceWorkspace() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<DashboardTotals | null>(null);
  const [notice, setNotice] = useState("");
  const [importing, setImporting] = useState(false);
  const [menu, setMenu] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function loadDocuments() {
    try {
      const response = await fetch("/api/documents?limit=100", { cache: "no-store" });
      if (!response.ok) return;
      const adapted = adaptDocumentsPayload(await response.json());
      setRows(adapted.rows);
      setTotals(adapted.totals);
    } catch { setNotice("Não foi possível carregar a base. Tente novamente."); }
  }

  useEffect(() => { void loadDocuments(); }, []);

  useEffect(() => {
    const context = (document as Document & { modelContext?: WebMcpContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const report = (error: unknown) => console.error("WebMCP registration failed", error);
    void Promise.resolve(context.registerTool({
      name: "search_financial_documents", title: "Buscar documentos financeiros",
      description: "Filtra a grade visível por número da nota, cliente, natureza ou situação.",
      inputSchema: { type: "object", properties: { query: { type: "string", maxLength: 120 } }, required: ["query"], additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
        const term = String((input as { query?: unknown })?.query ?? "").trim();
        setQuery(term);
        const normalized = term.toLocaleLowerCase("pt-BR");
        const count = rows.filter((row) => `${row.number} ${row.customer} ${row.nature} ${row.status}`.toLocaleLowerCase("pt-BR").includes(normalized)).length;
        return { query: term, visibleDocuments: count };
      },
    }, { signal: lifecycle.signal })).catch(report);
    void Promise.resolve(context.registerTool({
      name: "approve_financial_document_review", title: "Aprovar classificação financeira",
      description: "Aprova a categoria e o valor gerencial de um documento, respeitando o controle de versão.",
      inputSchema: { type: "object", properties: { documentId: { type: "string" }, category: { type: "string" }, managerialValueCents: { type: "integer" }, revision: { type: "integer", minimum: 1 }, reason: { type: "string" } }, required: ["documentId", "category", "managerialValueCents", "revision"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const response = await fetch("/api/reviews", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Não foi possível aprovar a classificação.");
        setNotice("Classificação aprovada e registrada no histórico.");
        await loadDocuments();
        return { outcome: result.outcome, revision: result.revision };
      },
    }, { signal: lifecycle.signal })).catch(report);
    return () => lifecycle.abort();
  }, [rows]);

  async function importFiles(files: FileList | null) {
    if (!files?.length) return;
    setImporting(true); setNotice("Processando arquivos e conferindo duplicidades…");
    const form = new FormData();
    form.set("label", `Importação ${new Date().toLocaleDateString("pt-BR")}`);
    [...files].forEach((file) => form.append("files", file));
    try {
      const response = await fetch("/api/imports", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Falha na importação.");
      setNotice(`${payload.summary.imported} importados, ${payload.summary.pending} pendentes, ${payload.summary.duplicate} repetidos e ${payload.summary.rejected} rejeitados.`);
      await loadDocuments();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível importar o lote."); }
    finally { setImporting(false); if (fileInput.current) fileInput.current.value = ""; }
  }
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return q ? rows.filter((r) => `${r.number} ${r.customer} ${r.nature} ${r.status}`.toLocaleLowerCase("pt-BR").includes(q)) : rows;
  }, [query]);

  return <main className="shell">
    <aside className="rail" aria-label="Navegação principal">
      <div className="brand">OF</div>
      <nav><button className="active" aria-label="Visão geral"><LayoutDashboard /></button><button aria-label="Importações"><UploadCloud /></button><button aria-label="Lançamentos"><ReceiptText /></button><button aria-label="Pagamentos"><WalletCards /></button><button aria-label="Relatórios"><FileSearch /></button></nav>
      <button className="settings" aria-label="Configurações"><Settings2 /></button>
    </aside>

    <section className="workspace">
      <header className="topbar">
        <div className="title"><button className="mobile-menu" onClick={() => setMenu(!menu)} aria-label="Abrir menu"><Menu /></button><div><p className="eyebrow">Controle operacional financeiro</p><h1>Visão geral</h1></div></div>
        <div className="top-actions"><div className="period"><span>Período</span><strong>Agosto de 2026</strong></div><input ref={fileInput} hidden type="file" multiple accept=".xml,.pdf,application/xml,text/xml,application/pdf" onChange={(event) => void importFiles(event.target.files)} /><Button className="import" disabled={importing} onClick={() => fileInput.current?.click()}><UploadCloud /> <span>{importing ? "Importando…" : "Importar arquivos"}</span></Button><div className="avatar">SF</div></div>
      </header>
      {menu && <nav className="mobile-nav"><button>Visão geral</button><button>Importações</button><button>Lançamentos</button><button>Pagamentos</button><button>Relatórios</button></nav>}

      <div className="dashboard">
        {notice && <div className="notice" role="status"><CheckCircle2 /> <span>{notice}</span><button onClick={() => setNotice("")} aria-label="Fechar aviso">×</button></div>}
        <section className="period-brief">
          <div><div className="period-label"><i /> Período em conferência</div><h2>Agosto fecha quando cada exceção tiver uma resposta.</h2><p>{totals?.documentCount ? "Base fiscal carregada. Restam as classificações gerenciais indicadas ao lado." : "Importe os XMLs e PDFs do período para iniciar a conferência."}</p></div>
          <div className="coverage"><div><span>Cobertura de revisão</span><strong>{totals?.documentCount ? Math.round(((totals.approvedCount ?? 0) / totals.documentCount) * 100) : 0}%</strong></div><Progress value={totals?.documentCount ? ((totals.approvedCount ?? 0) / totals.documentCount) * 100 : 0} /><footer><span>{totals?.documentCount ?? 0} documentos fiscais</span><span>{totals?.pendingCount ?? 0} pendências</span></footer></div>
        </section>

        <section className="metrics" aria-label="Indicadores principais">
          <article className="metric dark"><div className="icon"><CircleDollarSign /></div><p>Valor documental ativo</p><strong>{money.format((totals?.activeCents ?? 0) / 100)}</strong><small>{totals?.documentCount ?? 0} documentos importados</small></article>
          <article className="metric"><header><div className="icon coral"><ReceiptText /></div><span className="count">{totals?.approvedCount ?? 0}</span></header><p>Receita gerencial aprovada</p><strong>{money.format((totals?.approvedCents ?? 0) / 100)}</strong><small>Lançamentos revisados e aprovados</small></article>
          <article className="metric"><header><div className="icon amber"><AlertTriangle /></div><span className="count">{totals?.pendingCount ?? 0}</span></header><p>Pendências abertas</p><strong>{money.format((totals?.pendingCents ?? 0) / 100)}</strong><small>Valor documental aguardando revisão</small></article>
          <article className="metric"><header><div className="icon slate"><ShieldCheck /></div><span className="count slate">{totals?.cancelledCount ?? 0}</span></header><p>Cancelamentos aplicados</p><strong>{money.format((totals?.cancelledCents ?? 0) / 100)}</strong><small>Nenhum compõe o total ativo</small></article>
        </section>

        <section className="work-grid">
          <article className="panel queue">
            <PanelHeading eyebrow="Fila de trabalho" title="O que precisa de atenção"><Button variant="ghost" size="sm">Ver todas <ArrowUpRight /></Button></PanelHeading>
            <div className="queue-list">
              <Queue icon={<AlertTriangle />} title="Classificações pendentes" note="Categoria e valor gerencial aguardando revisão" count={String(totals?.pendingCount ?? 0)} alert />
              <Queue icon={<ListChecks />} title="Classificações aprovadas" note="Documentos conferidos pelo responsável" count={String(totals?.approvedCount ?? 0)} />
              <Queue icon={<FileText />} title="Documentos fiscais" note="Registros únicos atualmente conciliados" count={String(totals?.documentCount ?? 0)} />
            </div>
          </article>
          <article className="panel batch">
            <PanelHeading eyebrow="Base fiscal" title="Importação de agosto"><span className={`status ${totals?.pendingCount ? "review" : "approved"}`}><CheckCircle2 /> {totals?.documentCount ? (totals.pendingCount ? "Em conferência" : "Concluída") : "Aguardando arquivos"}</span></PanelHeading>
            <div className="batch-stats"><div><strong>{totals?.documentCount ?? 0}</strong><span>documentos</span></div><div><strong>{totals?.approvedCount ?? 0}</strong><span>aprovados</span></div><div><strong>{totals?.cancelledCount ?? 0}</strong><span>cancelados</span></div></div>
            <div className="result-bar"><i className="ok" /><i className="warn" /></div>
            <div className="legend"><span><i className="ok" /> Revisados {totals?.approvedCount ?? 0}</span><span><i className="warn" /> Pendentes {totals?.pendingCount ?? 0}</span></div>
            <Button variant="outline" className="full"><RotateCcw /> Abrir resultado do lote</Button>
          </article>
        </section>

        <section className="panel ledger">
          <PanelHeading eyebrow="Lançamentos recentes" title="Documentos do período">
            <div className="table-tools"><label className="search"><Search /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar nota ou cliente" /></label><Button variant="outline" size="sm"><Filter /> Filtrar</Button><Button variant="outline" size="sm" onClick={() => { window.location.href = "/api/export?month=2026-08"; }}><Download /> Excel</Button></div>
          </PanelHeading>
          <Table><TableHeader><TableRow><TableHead>Emissão</TableHead><TableHead>Nota</TableHead><TableHead>Cliente</TableHead><TableHead>Natureza</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Situação</TableHead><TableHead /></TableRow></TableHeader><TableBody>
            {filtered.map((r) => <TableRow key={r.id} className="doc-row"><TableCell>{r.issueDate}</TableCell><TableCell className="doc-number">#{r.number}</TableCell><TableCell className="customer">{r.customer}</TableCell><TableCell>{r.nature}</TableCell><TableCell className="amount">{money.format(r.amount)}</TableCell><TableCell><Status value={r.status} /></TableCell><TableCell>
              <Sheet><SheetTrigger asChild><button className="open" aria-label={`Abrir nota ${r.number}`}><ChevronRight /></button></SheetTrigger><SheetContent className="doc-sheet"><Details row={r} onApproved={() => { setNotice("Classificação aprovada e registrada no histórico."); void loadDocuments(); }} /></SheetContent></Sheet>
            </TableCell></TableRow>)}
            {!filtered.length && <TableRow><TableCell colSpan={7} className="ledger-empty">Nenhum documento no período. Importe XMLs ou PDFs para começar.</TableCell></TableRow>}
          </TableBody></Table>
          <footer className="table-footer"><span>Mostrando {filtered.length} de {totals?.documentCount ?? 0} documentos</span><Button variant="ghost" size="sm">Abrir lançamentos <ArrowUpRight /></Button></footer>
        </section>
      </div>
    </section>
  </main>;
}

function PanelHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <header className="panel-heading"><div><p className="eyebrow">{eyebrow}</p><h3>{title}</h3></div>{children}</header>;
}
function Queue({ icon, title, note, count, alert = false }: { icon: React.ReactNode; title: string; note: string; count: string; alert?: boolean }) {
  return <button><span className={alert ? "queue-icon alert" : "queue-icon"}>{icon}</span><span><strong>{title}</strong><small>{note}</small></span><b>{count}</b><ChevronRight /></button>;
}
function Details({ row, onApproved }: { row: Row; onApproved: () => void }) {
  const [category, setCategory] = useState("VENDAS");
  const [value, setValue] = useState(String(row.amount.toFixed(2)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function approve() {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/reviews", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentId: row.id, category, managerialValueCents: Math.round(Number(value) * 100), revision: row.revision, reason: "Conferido na tela operacional" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível aprovar.");
      onApproved();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível aprovar."); }
    finally { setSaving(false); }
  }

  return <div className="sheet-inner"><SheetHeader><p className="eyebrow">Conferência de documento</p><SheetTitle>NF-e #{row.number}</SheetTitle><SheetDescription>{row.customer}</SheetDescription></SheetHeader><div className="sheet-status"><Status value={row.status} /><span>{row.source}</span></div><div className="doc-preview"><FileText /><span>Original vinculado</span><small>Arquivo preservado para conferência e auditoria</small></div><dl className="details"><div><dt>Emissão</dt><dd>{row.issueDate}</dd></div><div><dt>Valor documental</dt><dd>{money.format(row.amount)}</dd></div><div><dt>Natureza</dt><dd>{row.nature}</dd></div><div><dt>Origem</dt><dd>{row.source}</dd></div></dl>{row.status === "Revisar" && <><div className="callout"><AlertTriangle /><div><strong>Decisão necessária</strong><p>Confirme o efeito financeiro desta operação antes de publicar o lançamento.</p></div></div><div className="review-fields"><label>Categoria<select value={category} onChange={(event) => setCategory(event.target.value)}><option>VENDAS</option><option>SERVIÇOS</option><option>CONTRATO</option><option>OUTROS</option></select></label><label>Valor gerencial<input type="number" min="0" step="0.01" value={value} onChange={(event) => setValue(event.target.value)} /></label>{error && <p role="alert">{error}</p>}</div></>}<div className="sheet-actions"><Button variant="outline">Devolver</Button><Button disabled={saving || row.status !== "Revisar"} onClick={() => void approve()}>{saving ? "Salvando…" : "Aprovar classificação"}</Button></div></div>;
}
