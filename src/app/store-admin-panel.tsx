"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ExternalLink, Eye, EyeOff, ImagePlus, Pencil, Plus, Save, Sparkles, Trash2, Wine, X } from "lucide-react";
import "./store-admin-panel.css";

type Item = { id: string; name: string; description: string; category: string; price: number; imageUrl?: string; available: boolean; featured: boolean };
type Draft = { name: string; description: string; category: string; price: string; imageUrl: string; available: boolean; featured: boolean };
const empty: Draft = { name: "", description: "", category: "Bebidas", price: "", imageUrl: "", available: true, featured: false };
const field = "mt-2 min-h-11 w-full rounded-xl border border-[#d8ddd5] bg-white px-3 text-base text-[#29342d] outline-[#6d947c]";

export default function StoreAdminPanel({ beta }: { beta: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [draft, setDraft] = useState<Draft>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const endpoint = "/api/store/admin";
  const refresh = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store", headers: { "x-refugio-mode": beta ? "beta" : "production" } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Não foi possível carregar os itens.");
    setItems(data.items);
  }, [beta]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(endpoint, { cache: "no-store", headers: { "x-refugio-mode": beta ? "beta" : "production" } });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Não foi possível carregar os itens.");
        if (active) setItems(data.items);
      } catch (error) {
        if (active) { setFailed(true); setMessage(error instanceof Error ? error.message : "Erro de conexão."); }
      }
    };
    void load();
    return () => { active = false; };
  }, [beta]);
  function startEdit(item: Item) { setEditing(item.id); setDraft({ name: item.name, description: item.description, category: item.category, price: String(item.price), imageUrl: item.imageUrl || "", available: item.available, featured: item.featured }); setMessage(""); }
  function reset() { setEditing(null); setDraft(empty); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setFailed(false);
    const payload = { ...draft, price: Number(draft.price) };
    try {
      const response = await fetch(editing ? `${endpoint}/${editing}` : endpoint, { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json", "x-refugio-mode": beta ? "beta" : "production" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Não foi possível salvar o item.");
      await refresh(); reset(); setMessage(editing ? "Item atualizado." : "Item adicionado ao cardápio.");
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "Erro de conexão."); }
    finally { setBusy(false); }
  }
  async function remove(item: Item) {
    if (!window.confirm(`Remover “${item.name}” do cardápio?`)) return;
    setBusy(true); setMessage(""); setFailed(false);
    try {
      const response = await fetch(`${endpoint}/${item.id}`, { method: "DELETE", headers: { "x-refugio-mode": beta ? "beta" : "production" } });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || "Não foi possível remover o item.");
      await refresh(); if (editing === item.id) reset(); setMessage("Item removido do cardápio.");
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "Erro de conexão."); }
    finally { setBusy(false); }
  }

  return <div className="store-admin-panel mt-6 space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 text-lg font-semibold"><Wine size={20} /> Cardápio da adega</h3><p className="mt-1 text-sm leading-6 text-[#596258]">Cadastre os itens que aparecem para os clientes na página pública, sem acesso ao painel.</p></div><a href="/loja" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#b7ccbc] px-4 text-sm font-semibold text-[#1f4b3a]"><ExternalLink size={16} /> Abrir página pública</a></div>
    {beta && <p className="rounded-xl border border-[#e5d1af] bg-[#f7f0e4] p-4 text-sm leading-6 text-[#805b2c]">Catálogo de teste isolado. Os itens deste ambiente não aparecem na loja pública.</p>}
    <form onSubmit={save} className="store-admin-form grid gap-4 rounded-2xl border border-[#e4e3dc] bg-[#fcfcfa] p-4 sm:grid-cols-2 sm:p-5"><div className="sm:col-span-2 flex items-center justify-between"><h4 className="font-semibold">{editing ? "Editar item" : "Novo item"}</h4>{editing && <button type="button" onClick={reset} className="inline-flex min-h-10 items-center gap-2 px-2 text-sm text-[#596258]"><X size={16} /> Cancelar edição</button>}</div>
      <label className="text-sm font-semibold">Nome do item<input className={field} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} required maxLength={100} placeholder="Ex.: Vinho da Serra" /></label>
      <label className="text-sm font-semibold">Categoria<input className={field} value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })} required maxLength={40} placeholder="Vinhos, cafés, petiscos…" /></label>
      <label className="text-sm font-semibold">Preço (R$)<input className={field} type="number" inputMode="decimal" min="0.01" max="1000000" step="0.01" value={draft.price} onChange={event => setDraft({ ...draft, price: event.target.value })} required placeholder="0,00" /></label>
      <label className="text-sm font-semibold">Imagem (endereço HTTPS)<span className="relative block"><ImagePlus size={17} className="absolute left-3 top-5 text-[#758078]" /><input className={`${field} pl-9`} type="url" value={draft.imageUrl} onChange={event => setDraft({ ...draft, imageUrl: event.target.value })} placeholder="Opcional" /></span></label>
      <label className="text-sm font-semibold sm:col-span-2">Descrição<textarea className={`${field} min-h-24 py-3`} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} maxLength={500} placeholder="Conte um pouco sobre este item…" /></label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={draft.available} onChange={event => setDraft({ ...draft, available: event.target.checked })} className="size-4 accent-[#285746]" /><Eye size={17} /> Visível para clientes</label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={draft.featured} onChange={event => setDraft({ ...draft, featured: event.target.checked })} className="size-4 accent-[#285746]" /><Sparkles size={17} /> Destacar como escolha da casa</label>
      <div className="sm:col-span-2 flex flex-wrap items-center gap-3"><button disabled={busy} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#285746] px-5 text-sm font-semibold text-white disabled:opacity-55"><Save size={17} /> {busy ? "Salvando…" : editing ? "Salvar alterações" : "Adicionar ao cardápio"}</button><p role="status" aria-live="polite" className={`text-sm ${failed ? "text-[#a65746]" : "text-[#285746]"}`}>{message}</p></div>
    </form>
    <div><div className="mb-3 flex items-center justify-between"><h4 className="font-semibold">Itens cadastrados</h4><span className="text-sm text-[#596258]">{items.length} {items.length === 1 ? "item" : "itens"}</span></div>{items.length ? <ul className="divide-y divide-[#e4e3dc] rounded-2xl border border-[#e4e3dc]">{items.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="flex min-w-0 items-center gap-3">{item.imageUrl ? <img src={item.imageUrl} alt="" className="size-12 rounded-xl object-cover" referrerPolicy="no-referrer" /> : <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#e8eee8] text-[#285746]"><Wine size={21} /></span>}<div className="min-w-0"><p className="truncate font-semibold">{item.name}</p><p className="mt-1 text-sm text-[#596258]">{item.category} · {item.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · {item.available ? <span className="text-[#285746]">Publicado</span> : <span className="inline-flex items-center gap-1"><EyeOff size={13} /> Oculto</span>}{item.featured && " · Destaque"}</p></div></div><div className="flex shrink-0 gap-2"><button type="button" disabled={busy} onClick={() => startEdit(item)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#d8ddd5] px-3 text-sm font-semibold text-[#29342d]"><Pencil size={15} /> Editar</button><button type="button" disabled={busy} onClick={() => remove(item)} aria-label={`Remover ${item.name}`} className="grid size-10 place-items-center rounded-lg border border-[#ead4cd] text-[#a65746]"><Trash2 size={16} /></button></div></li>)}</ul> : <div className="rounded-2xl border border-dashed border-[#d8ddd5] p-8 text-center text-sm leading-6 text-[#596258]">Ainda não há itens. Use o formulário acima para montar o cardápio.</div>}</div>
    <button type="button" onClick={() => { setDraft(empty); setEditing(null); setMessage(""); }} className="sr-only"><Plus size={16} /> Novo item</button>
  </div>;
}
