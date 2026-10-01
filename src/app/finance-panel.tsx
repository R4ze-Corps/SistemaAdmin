"use client";
import BetaDialog from "./beta-dialog";
import { useWorkspace } from "./workspace-context";

import { FormEvent, useMemo, useState } from "react";
import PayablesPanel, { type Payable } from "./payables-panel";
import { ArrowDownLeft, ArrowUpRight, Banknote, CalendarDays, Pencil, Plus, ReceiptText, Save, Trash2, WalletCards, X } from "lucide-react";

export type FinanceKind = "entrada" | "saida";
export type PaymentMethod = "Dinheiro" | "PIX" | "Cartão de crédito" | "Cartão de débito" | "Transferência" | "Conta bancária" | "Cheque" | "Boleto" | "Outro";
export type FinanceEntry = { id: string; kind: FinanceKind; description: string; amount: number; date: string; method: PaymentMethod; category: string; notes: string; createdAt: string };
type FinanceDraft = Omit<FinanceEntry, "id" | "createdAt"> & { id?: string };

const methods: PaymentMethod[] = ["Dinheiro", "PIX", "Cartão de crédito", "Cartão de débito", "Transferência", "Conta bancária", "Cheque", "Boleto", "Outro"];
const categories = ["Hospedagem", "Café da manhã", "Decoração", "Manutenção", "Limpeza", "Compras", "Energia", "Internet", "Impostos", "Pagamento", "Outro"];
const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const emptyDraft = (): FinanceDraft => ({ kind: "entrada", description: "", amount: 0, date: today(), method: "PIX", category: "Hospedagem", notes: "" });

export default function FinancePanel({ entries, onChange, payables, onPayablesChange, onNotice }: { entries: FinanceEntry[]; onChange: (entries: FinanceEntry[]) => void; payables: Payable[]; onPayablesChange: (items: Payable[]) => void; onNotice: (message: string) => void }) {
  const [draft, setDraft] = useState<FinanceDraft | null>(null);
  const [section, setSection] = useState<"transactions" | "payables">("transactions");
  const [methodFilter, setMethodFilter] = useState<"Todos" | PaymentMethod>("Todos");
  const [month, setMonth] = useState(currentMonth());

  const totalIn = entries.filter((entry) => entry.kind === "entrada").reduce((sum, entry) => sum + entry.amount, 0);
  const totalOut = entries.filter((entry) => entry.kind === "saida").reduce((sum, entry) => sum + entry.amount, 0);
  const balance = totalIn - totalOut;
  const monthEntries = useMemo(() => entries.filter((entry) => entry.date.startsWith(month)), [entries, month]);
  const monthIn = monthEntries.filter((entry) => entry.kind === "entrada").reduce((sum, entry) => sum + entry.amount, 0);
  const monthOut = monthEntries.filter((entry) => entry.kind === "saida").reduce((sum, entry) => sum + entry.amount, 0);
  const visible = monthEntries.filter((entry) => methodFilter === "Todos" || entry.method === methodFilter).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || !draft.description.trim() || Number(draft.amount) <= 0) return onNotice("Informe a descrição e um valor maior que zero.");
    const entry: FinanceEntry = { ...draft, id: draft.id ?? crypto.randomUUID(), description: draft.description.trim(), amount: Math.round(Number(draft.amount) * 100) / 100, createdAt: draft.id ? entries.find((item) => item.id === draft.id)?.createdAt ?? new Date().toISOString() : new Date().toISOString() };
    onChange(draft.id ? entries.map((item) => item.id === draft.id ? entry : item) : [...entries, entry]);
    setDraft(null);
    onNotice(draft.id ? "Lançamento atualizado." : "Lançamento adicionado ao financeiro.");
  };

  const remove = (id: string) => {
    if (!window.confirm("Excluir este lançamento financeiro?")) return;
    onChange(entries.filter((entry) => entry.id !== id));
    onNotice("Lançamento excluído.");
  };

  return <section className="p-5 md:p-8">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-[9px] font-bold tracking-[.14em] text-[#758078]">CONTROLE FINANCEIRO</p><h2 className="mt-1 text-2xl font-bold tracking-[-.055em] md:text-[28px]">{section === "transactions" ? "Entradas e saídas" : "Contas a pagar"}</h2><p className="mt-2 text-xs text-[#758078]">{section === "transactions" ? "Registre tudo que entrou ou saiu e acompanhe o saldo automaticamente." : "Acompanhe produtos, serviços, parcelas e datas de vencimento."}</p></div>{section === "transactions" && <button onClick={() => setDraft(emptyDraft())} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1f4b3a] px-4 text-xs font-bold text-white"><Plus size={16} /> Novo lançamento</button>}</div>
    <div className="mt-6 inline-flex rounded-xl bg-[#eeeee8] p-1"><button onClick={() => setSection("transactions")} className={`rounded-lg px-4 py-2 text-[10px] font-bold ${section === "transactions" ? "bg-white text-[#1f4b3a] shadow-sm" : "text-[#68736c]"}`}>Movimentações</button><button onClick={() => setSection("payables")} className={`rounded-lg px-4 py-2 text-[10px] font-bold ${section === "payables" ? "bg-white text-[#1f4b3a] shadow-sm" : "text-[#68736c]"}`}>Contas a pagar</button></div>

    {section === "transactions" ? <><div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <FinanceMetric label="Saldo total" value={money(balance)} note="entradas menos saídas" icon={<WalletCards size={18} />} tone={balance < 0 ? "red" : "green"} />
      <FinanceMetric label="Entradas totais" value={money(totalIn)} note="todo o período" icon={<ArrowUpRight size={18} />} tone="green" />
      <FinanceMetric label="Entradas no mês" value={money(monthIn)} note={month.split("-").reverse().join("/")} icon={<Banknote size={18} />} tone="green" />
      <FinanceMetric label="Saídas no mês" value={money(monthOut)} note={month.split("-").reverse().join("/")} icon={<ArrowDownLeft size={18} />} tone="red" />
    </div>

    <div className="mt-7 rounded-2xl border border-[#e4e3dc] bg-white p-4 md:p-5"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-center"><div><h3 className="text-sm font-bold">Movimentações</h3><p className="mt-1 text-[10px] text-[#758078]">Cartões, contas, cheques e demais formas de pagamento.</p></div><label className="flex items-center gap-2 rounded-xl border border-[#e4e3dc] bg-[#fffefa] px-3 py-2 text-[10px] font-bold text-[#59655e]"><CalendarDays size={14} /><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="bg-transparent text-xs outline-none" /></label></div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{(["Todos", ...methods] as const).map((method) => <button key={method} onClick={() => setMethodFilter(method)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-[10px] font-bold ${methodFilter === method ? "bg-[#1f4b3a] text-white" : "bg-[#f1f1eb] text-[#68736c]"}`}>{method}</button>)}</div>
      {visible.length ? <div className="mt-4 grid gap-2">{visible.map((entry) => <article key={entry.id} className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[#ebeae3] p-3"><span className={`grid h-10 w-10 place-items-center rounded-xl ${entry.kind === "entrada" ? "bg-[#e5f2e9] text-[#347053]" : "bg-[#f9e8e4] text-[#a65746]"}`}>{entry.kind === "entrada" ? <ArrowUpRight size={17} /> : <ArrowDownLeft size={17} />}</span><div className="min-w-0"><b className="block truncate text-xs">{entry.description}</b><span className="mt-1 block truncate text-[9px] text-[#758078]">{new Date(`${entry.date}T12:00:00`).toLocaleDateString("pt-BR")} · {entry.method} · {entry.category}{entry.notes ? ` · ${entry.notes}` : ""}</span></div><div className="flex items-center gap-2"><b className={`whitespace-nowrap text-xs ${entry.kind === "entrada" ? "text-[#347053]" : "text-[#a65746]"}`}>{entry.kind === "entrada" ? "+" : "−"} {money(entry.amount)}</b><button onClick={() => setDraft({ ...entry })} className="grid h-8 w-8 place-items-center rounded-lg bg-[#f1f3ef] text-[#536158]" aria-label="Editar lançamento"><Pencil size={13} /></button><button onClick={() => remove(entry.id)} className="grid h-8 w-8 place-items-center rounded-lg bg-[#fff1ee] text-[#a65746]" aria-label="Excluir lançamento"><Trash2 size={13} /></button></div></article>)}</div> : <div className="mt-4 grid min-h-48 place-items-center rounded-xl border border-dashed border-[#d7d9d3] bg-[#fdfdf9] p-6 text-center"><div><ReceiptText size={24} className="mx-auto text-[#829087]" /><b className="mt-3 block text-xs">Nenhum lançamento encontrado</b><p className="mt-1 text-[10px] text-[#7c867f]">Adicione uma entrada ou saída para este período.</p></div></div>}
    </div></> : <PayablesPanel items={payables} onChange={onPayablesChange} onNotice={onNotice} />}

    {draft && <FinanceModal draft={draft} setDraft={setDraft} onSave={save} onClose={() => setDraft(null)} />}
  </section>;
}

function FinanceMetric({ label, value, note, icon, tone }: { label: string; value: string; note: string; icon: React.ReactNode; tone: "green" | "red" }) {
  return <div className="rounded-2xl border border-[#e4e3dc] bg-white p-4"><span className={`grid h-9 w-9 place-items-center rounded-xl ${tone === "red" ? "bg-[#f9e8e4] text-[#a65746]" : "bg-[#e5f2e9] text-[#347053]"}`}>{icon}</span><p className="mt-4 text-[9px] font-bold text-[#778078]">{label}</p><strong className={`mt-1 block text-xl tracking-[-.04em] ${tone === "red" ? "text-[#a65746]" : "text-[#1f4b3a]"}`}>{value}</strong><small className="mt-1 block text-[9px] text-[#8a928b]">{note}</small></div>;
}

function FinanceModal({ draft, setDraft, onSave, onClose }: { draft: FinanceDraft; setDraft: (draft: FinanceDraft) => void; onSave: (event: FormEvent<HTMLFormElement>) => void; onClose: () => void }) {
  const beta = useWorkspace().mode === "beta";
  const field = <K extends keyof FinanceDraft>(key: K, value: FinanceDraft[K]) => setDraft({ ...draft, [key]: value });
  if (beta) return <BetaDialog onClose={onClose}><form onSubmit={onSave}><p className="text-[9px] font-bold tracking-[.14em] text-[#758078]">FINANCEIRO</p><h2 className="mt-1 text-2xl font-bold tracking-[-.05em]">{draft.id ? "Editar lançamento" : "Novo lançamento"}</h2><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" aria-pressed={draft.kind === "entrada"} onClick={() => field("kind", "entrada")} className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-xs font-bold ${draft.kind === "entrada" ? "border-[#a9ceb6] bg-[#eaf5ed] text-[#347053]" : "border-[#e4e3dc] bg-white text-[#69736d]"}`}><ArrowUpRight size={15} /> Entrada</button><button type="button" aria-pressed={draft.kind === "saida"} onClick={() => field("kind", "saida")} className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-xs font-bold ${draft.kind === "saida" ? "border-[#edc7bd] bg-[#fff0ed] text-[#a65746]" : "border-[#e4e3dc] bg-white text-[#69736d]"}`}><ArrowDownLeft size={15} /> Saída</button></div><div className="mt-4 grid gap-3"><FinanceField label={draft.kind === "entrada" ? "O que gerou esta entrada?" : "Com o que você gastou?"}><input required value={draft.description} onChange={(event) => field("description", event.target.value)} placeholder={draft.kind === "entrada" ? "Ex.: Pagamento da reserva" : "Ex.: Compra de materiais"} /></FinanceField><div className="grid grid-cols-2 gap-3"><FinanceField label="Valor"><input required type="number" min="0.01" step="0.01" value={draft.amount || ""} onChange={(event) => field("amount", Number(event.target.value))} placeholder="0,00" /></FinanceField><FinanceField label="Data"><input required type="date" value={draft.date} onChange={(event) => field("date", event.target.value)} /></FinanceField></div><div className="grid grid-cols-2 gap-3"><FinanceField label="Forma / conta"><select value={draft.method} onChange={(event) => field("method", event.target.value as PaymentMethod)}>{methods.map((method) => <option key={method}>{method}</option>)}</select></FinanceField><FinanceField label="Categoria"><select value={draft.category} onChange={(event) => field("category", event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></FinanceField></div><FinanceField label="Observações"><textarea value={draft.notes} onChange={(event) => field("notes", event.target.value)} placeholder="Informações adicionais, número do cheque, parcela..." /></FinanceField></div><button className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1f4b3a] text-xs font-bold text-white"><Save size={15} /> Salvar lançamento</button></form></BetaDialog>;
  return <div className="fixed inset-0 z-40 grid place-items-center bg-[#18272065] p-4 backdrop-blur-sm"><section className="relative max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-[22px] bg-[#fffefa] p-6 shadow-2xl"><button type="button" onClick={onClose} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg border border-[#e4e3dc] bg-white" aria-label="Fechar"><X size={17} /></button><form onSubmit={onSave}><p className="text-[9px] font-bold tracking-[.14em] text-[#758078]">FINANCEIRO</p><h2 className="mt-1 text-2xl font-bold tracking-[-.05em]">{draft.id ? "Editar lançamento" : "Novo lançamento"}</h2><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => field("kind", "entrada")} className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-xs font-bold ${draft.kind === "entrada" ? "border-[#a9ceb6] bg-[#eaf5ed] text-[#347053]" : "border-[#e4e3dc] bg-white text-[#69736d]"}`}><ArrowUpRight size={15} /> Entrada</button><button type="button" onClick={() => field("kind", "saida")} className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-xs font-bold ${draft.kind === "saida" ? "border-[#edc7bd] bg-[#fff0ed] text-[#a65746]" : "border-[#e4e3dc] bg-white text-[#69736d]"}`}><ArrowDownLeft size={15} /> Saída</button></div><div className="mt-4 grid gap-3"><FinanceField label={draft.kind === "entrada" ? "O que gerou esta entrada?" : "Com o que você gastou?"}><input required value={draft.description} onChange={(event) => field("description", event.target.value)} placeholder={draft.kind === "entrada" ? "Ex.: Pagamento da reserva" : "Ex.: Compra de materiais"} /></FinanceField><div className="grid grid-cols-2 gap-3"><FinanceField label="Valor"><input required type="number" min="0.01" step="0.01" value={draft.amount || ""} onChange={(event) => field("amount", Number(event.target.value))} placeholder="0,00" /></FinanceField><FinanceField label="Data"><input required type="date" value={draft.date} onChange={(event) => field("date", event.target.value)} /></FinanceField></div><div className="grid grid-cols-2 gap-3"><FinanceField label="Forma / conta"><select value={draft.method} onChange={(event) => field("method", event.target.value as PaymentMethod)}>{methods.map((method) => <option key={method}>{method}</option>)}</select></FinanceField><FinanceField label="Categoria"><select value={draft.category} onChange={(event) => field("category", event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></FinanceField></div><FinanceField label="Observações"><textarea value={draft.notes} onChange={(event) => field("notes", event.target.value)} placeholder="Informações adicionais, número do cheque, parcela..." /></FinanceField></div><button className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1f4b3a] text-xs font-bold text-white"><Save size={15} /> Salvar lançamento</button></form></section></div>;
}

function FinanceField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-[10px] font-bold text-[#5e6962]">{label}<span className="[&_input]:h-10 [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-[#dcded8] [&_input]:bg-white [&_input]:px-3 [&_input]:text-xs [&_input]:outline-[#75a385] [&_select]:h-10 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-[#dcded8] [&_select]:bg-white [&_select]:px-3 [&_select]:text-xs [&_textarea]:min-h-20 [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-[#dcded8] [&_textarea]:bg-white [&_textarea]:p-3 [&_textarea]:text-xs [&_textarea]:outline-[#75a385]">{children}</span></label>;
}
