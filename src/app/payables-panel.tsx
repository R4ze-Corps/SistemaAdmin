"use client";

import { FormEvent, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Check, CircleDollarSign, Pencil, Plus, Save, Trash2, X } from "lucide-react";

export type Payable = { id: string; productName: string; description: string; amount: number; startDate: string; dueDate: string; totalInstallments: number; paidInstallments: number; createdAt: string };
type PayableDraft = Omit<Payable, "id" | "createdAt"> & { id?: string };

const isoToday = () => new Date().toISOString().slice(0, 10);
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
const dayDiff = (value: string) => Math.ceil((new Date(`${value}T23:59:59`).getTime() - new Date(`${isoToday()}T00:00:00`).getTime()) / 86_400_000);
const remainingValue = (item: Payable) => item.amount * Math.max(0, item.totalInstallments - item.paidInstallments) / item.totalInstallments;
const blank = (): PayableDraft => ({ productName: "", description: "", amount: 0, startDate: isoToday(), dueDate: isoToday(), totalInstallments: 1, paidInstallments: 0 });

function status(item: Payable) {
  if (item.paidInstallments >= item.totalInstallments) return { label: "Pago", tone: "green" as const };
  const days = dayDiff(item.dueDate);
  if (days < 0) return { label: `Vencida há ${Math.abs(days)} dia(s)`, tone: "red" as const };
  if (days === 0) return { label: "Vence hoje", tone: "red" as const };
  if (days <= 7) return { label: `Vence em ${days} dia(s)`, tone: "amber" as const };
  return { label: "Em aberto", tone: "neutral" as const };
}

export default function PayablesPanel({ items, onChange, onNotice }: { items: Payable[]; onChange: (items: Payable[]) => void; onNotice: (message: string) => void }) {
  const [draft, setDraft] = useState<PayableDraft | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "alert" | "paid">("all");
  const totalOpen = items.reduce((sum, item) => sum + remainingValue(item), 0);
  const overdue = items.filter((item) => item.paidInstallments < item.totalInstallments && dayDiff(item.dueDate) < 0);
  const dueSoon = items.filter((item) => item.paidInstallments < item.totalInstallments && dayDiff(item.dueDate) >= 0 && dayDiff(item.dueDate) <= 7);
  const paid = items.filter((item) => item.paidInstallments >= item.totalInstallments);
  const visible = useMemo(() => items.filter((item) => {
    const itemStatus = status(item);
    if (filter === "open") return itemStatus.tone === "neutral";
    if (filter === "alert") return itemStatus.tone === "red" || itemStatus.tone === "amber";
    if (filter === "paid") return itemStatus.tone === "green";
    return true;
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [items, filter]);

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || !draft.productName.trim() || Number(draft.amount) <= 0) return onNotice("Informe o produto e um valor maior que zero.");
    if (!draft.startDate || !draft.dueDate || draft.dueDate < draft.startDate) return onNotice("O vencimento deve ser igual ou posterior à data de início.");
    const totalInstallments = Math.max(1, Math.floor(Number(draft.totalInstallments) || 1));
    const paidInstallments = Math.min(totalInstallments, Math.max(0, Math.floor(Number(draft.paidInstallments) || 0)));
    const payable: Payable = { ...draft, id: draft.id ?? crypto.randomUUID(), productName: draft.productName.trim(), amount: Math.round(Number(draft.amount) * 100) / 100, totalInstallments, paidInstallments, createdAt: draft.id ? items.find((item) => item.id === draft.id)?.createdAt ?? new Date().toISOString() : new Date().toISOString() };
    onChange(draft.id ? items.map((item) => item.id === draft.id ? payable : item) : [...items, payable]);
    setDraft(null);
    onNotice(draft.id ? "Conta atualizada." : "Conta a pagar adicionada.");
  };

  const payNext = (item: Payable) => {
    if (item.paidInstallments >= item.totalInstallments) return;
    onChange(items.map((current) => current.id === item.id ? { ...current, paidInstallments: current.paidInstallments + 1 } : current));
    onNotice(item.paidInstallments + 1 === item.totalInstallments ? "Conta totalmente paga." : "Parcela marcada como paga.");
  };

  const remove = (id: string) => {
    if (!window.confirm("Excluir esta conta a pagar?")) return;
    onChange(items.filter((item) => item.id !== id));
    onNotice("Conta excluída.");
  };

  return <div className="mt-6">
    {(overdue.length > 0 || dueSoon.length > 0) && <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[#edc7bd] bg-[#fff0ed] p-4 text-[#a65746]"><AlertTriangle size={18} className="mt-0.5 shrink-0" /><div><b className="text-xs">Atenção aos vencimentos</b><p className="mt-1 text-[10px] leading-4">{overdue.length ? `${overdue.length} conta(s) vencida(s). ` : ""}{dueSoon.length ? `${dueSoon.length} conta(s) vencem nos próximos 7 dias.` : ""}</p></div></div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><PayableMetric label="Total em aberto" value={money(totalOpen)} icon={<CircleDollarSign size={18} />} tone="neutral" /><PayableMetric label="Vencidas" value={String(overdue.length)} icon={<AlertTriangle size={18} />} tone="red" /><PayableMetric label="Próximas do vencimento" value={String(dueSoon.length)} icon={<CalendarClock size={18} />} tone="amber" /><PayableMetric label="Contas pagas" value={String(paid.length)} icon={<Check size={18} />} tone="green" /></div>
    <div className="mt-6 rounded-2xl border border-[#e4e3dc] bg-white p-4 md:p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h3 className="text-sm font-bold">Contas cadastradas</h3><p className="mt-1 text-[10px] text-[#758078]">Produtos, serviços, parcelas e vencimentos.</p></div><button onClick={() => setDraft(blank())} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1f4b3a] px-4 text-xs font-bold text-white"><Plus size={15} /> Nova conta</button></div>
      <div className="mt-4 flex gap-2 overflow-x-auto">{([['all','Todas'],['open','Em aberto'],['alert','Alertas'],['paid','Pagas']] as const).map(([key, label]) => <button key={key} onClick={() => setFilter(key)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-[10px] font-bold ${filter === key ? "bg-[#1f4b3a] text-white" : "bg-[#f1f1eb] text-[#68736c]"}`}>{label}</button>)}</div>
      {visible.length ? <div className="mt-4 grid gap-3">{visible.map((item) => { const itemStatus = status(item); const progress = Math.round(item.paidInstallments / item.totalInstallments * 100); return <article key={item.id} className="rounded-xl border border-[#ebeae3] p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><b className="text-xs">{item.productName}</b><span className={`rounded-full px-2 py-1 text-[8px] font-bold ${itemStatus.tone === "red" ? "bg-[#fff0ed] text-[#a65746]" : itemStatus.tone === "amber" ? "bg-[#f3e9da] text-[#906a36]" : itemStatus.tone === "green" ? "bg-[#eaf5ed] text-[#347053]" : "bg-[#f1f1eb] text-[#68736c]"}`}>{itemStatus.label}</span></div><p className="mt-1 text-[10px] text-[#758078]">{item.description || "Sem descrição"}</p></div><b className="whitespace-nowrap text-sm text-[#1f4b3a]">{money(item.amount)}</b></div><div className="mt-4 grid gap-3 text-[10px] sm:grid-cols-3"><span><small className="block text-[8px] font-bold text-[#758078]">INÍCIO</small><b className="mt-1 block">{dateLabel(item.startDate)}</b></span><span><small className="block text-[8px] font-bold text-[#758078]">VENCIMENTO</small><b className="mt-1 block">{dateLabel(item.dueDate)}</b></span><span><small className="block text-[8px] font-bold text-[#758078]">RESTANTE</small><b className="mt-1 block">{money(remainingValue(item))}</b></span></div><div className="mt-4"><div className="flex justify-between text-[9px] font-bold text-[#68736c]"><span>{item.paidInstallments} de {item.totalInstallments} parcela(s) paga(s)</span><span>{progress}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#ecece6]"><i className="block h-full rounded-full bg-[#1f4b3a] transition-all" style={{ width: `${progress}%` }} /></div></div><div className="mt-4 flex flex-wrap justify-end gap-2">{item.paidInstallments < item.totalInstallments && <button onClick={() => payNext(item)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#eaf5ed] px-3 text-[10px] font-bold text-[#347053]"><Check size={13} /> Registrar parcela paga</button>}<button onClick={() => setDraft({ ...item })} className="grid h-9 w-9 place-items-center rounded-lg bg-[#f1f3ef] text-[#536158]" aria-label="Editar conta"><Pencil size={13} /></button><button onClick={() => remove(item.id)} className="grid h-9 w-9 place-items-center rounded-lg bg-[#fff1ee] text-[#a65746]" aria-label="Excluir conta"><Trash2 size={13} /></button></div></article>; })}</div> : <div className="mt-4 grid min-h-44 place-items-center rounded-xl border border-dashed border-[#d7d9d3] bg-[#fdfdf9] text-center"><div><CalendarClock size={24} className="mx-auto text-[#829087]" /><b className="mt-3 block text-xs">Nenhuma conta encontrada</b><p className="mt-1 text-[10px] text-[#758078]">Cadastre uma conta para acompanhar vencimentos.</p></div></div>}
    </div>
    {draft && <PayableModal draft={draft} setDraft={setDraft} onSave={save} onClose={() => setDraft(null)} />}
  </div>;
}

function PayableMetric({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: "neutral" | "red" | "amber" | "green" }) {
  const classes = tone === "red" ? "bg-[#fff0ed] text-[#a65746]" : tone === "amber" ? "bg-[#f3e9da] text-[#906a36]" : tone === "green" ? "bg-[#eaf5ed] text-[#347053]" : "bg-[#edf3ee] text-[#1f4b3a]";
  return <div className="rounded-2xl border border-[#e4e3dc] bg-white p-4"><span className={`grid h-9 w-9 place-items-center rounded-xl ${classes}`}>{icon}</span><p className="mt-4 text-[9px] font-bold text-[#778078]">{label}</p><strong className="mt-1 block text-xl tracking-[-.04em]">{value}</strong></div>;
}

function PayableModal({ draft, setDraft, onSave, onClose }: { draft: PayableDraft; setDraft: (draft: PayableDraft) => void; onSave: (event: FormEvent<HTMLFormElement>) => void; onClose: () => void }) {
  const field = <K extends keyof PayableDraft>(key: K, value: PayableDraft[K]) => setDraft({ ...draft, [key]: value });
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#18272065] p-4 backdrop-blur-sm"><section className="relative max-h-[92vh] w-full max-w-[540px] overflow-y-auto rounded-[22px] bg-[#fffefa] p-6 shadow-2xl"><button type="button" onClick={onClose} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg border border-[#e4e3dc] bg-white"><X size={17} /></button><form onSubmit={onSave}><p className="text-[9px] font-bold tracking-[.14em] text-[#758078]">CONTAS A PAGAR</p><h2 className="mt-1 text-2xl font-bold tracking-[-.05em]">{draft.id ? "Editar conta" : "Nova conta"}</h2><div className="mt-5 grid gap-3"><PayableField label="Nome do produto ou serviço"><input required value={draft.productName} onChange={(event) => field("productName", event.target.value)} placeholder="Ex.: Geladeira, energia, fornecedor" /></PayableField><PayableField label="Descrição"><textarea value={draft.description} onChange={(event) => field("description", event.target.value)} placeholder="Detalhes da compra ou serviço..." /></PayableField><PayableField label="Valor total"><input required type="number" min="0.01" step="0.01" value={draft.amount || ""} onChange={(event) => field("amount", Number(event.target.value))} placeholder="0,00" /></PayableField><div className="grid grid-cols-2 gap-3"><PayableField label="Data de início"><input required type="date" value={draft.startDate} onChange={(event) => field("startDate", event.target.value)} /></PayableField><PayableField label="Data de vencimento"><input required type="date" value={draft.dueDate} onChange={(event) => field("dueDate", event.target.value)} /></PayableField></div><div className="grid grid-cols-2 gap-3"><PayableField label="Parcelas totais"><input required type="number" min="1" value={draft.totalInstallments} onChange={(event) => field("totalInstallments", Number(event.target.value))} /></PayableField><PayableField label="Parcelas já pagas"><input required type="number" min="0" max={draft.totalInstallments} value={draft.paidInstallments} onChange={(event) => field("paidInstallments", Number(event.target.value))} /></PayableField></div></div><button className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1f4b3a] text-xs font-bold text-white"><Save size={15} /> Salvar conta</button></form></section></div>;
}

function PayableField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-[10px] font-bold text-[#5e6962]">{label}<span className="[&_input]:h-10 [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-[#dcded8] [&_input]:bg-white [&_input]:px-3 [&_input]:text-xs [&_input]:outline-[#75a385] [&_textarea]:min-h-20 [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-[#dcded8] [&_textarea]:bg-white [&_textarea]:p-3 [&_textarea]:text-xs [&_textarea]:outline-[#75a385]">{children}</span></label>;
}
