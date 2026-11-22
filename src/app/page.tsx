"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { upload } from "@vercel/blob/client";
import FinancePanel, { type FinanceEntry } from "./finance-panel";
import { type Payable } from "./payables-panel";
import AuthGate from "./auth-gate";
import { applyTheme, effectiveTheme } from "./settings-panel";
import BetaDialog from "./beta-dialog";
import { BetaFeedbackContext } from "./beta-feedback";
import GlassTabs from "./glass-tabs";
import { GlassCalendar, GlassDatePicker } from "./glass-calendar";
import GlassSelectMenu from "./glass-select";
import { GlassButton } from "@/components/ui/glass-button";
import { Glass, GlassSurface } from "@/components/ui/glass";
import { GlassSwitch as GlassCNGlassSwitch } from "@/components/ui/glass-switch";
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card";
import "./glass-tabs.css";
import "./glass-switch.css";
import { useWorkspace } from "./workspace-context";
import { ArrowRight, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Coffee, Dog, Download, Ellipsis, FileText, LayoutDashboard, LogIn, LogOut, Moon, Paperclip, PartyPopper, Pencil, Plus, Save, Settings, Settings2, Trash2, Sun, TreePalm, Upload, Users, WalletCards, Wine, X, Boxes } from "lucide-react";

type Cabin = { id: string; name: string; tone: "emerald" | "amber" | "violet" | "rose" };
type Attachment = { id: string; name: string; type: string; size: number; pathname?: string; url?: string; data?: string };
type BookingStatus = "Reservado" | "Check-in realizado" | "Finalizada";
type Booking = { id: string; cabinId: string; guestName: string; people: number; start: string; end: string; checkIn: string; checkOut: string; pets: boolean; breakfast: boolean; intolerance: string; decoration: boolean; notes: string; documents: Attachment[]; status: BookingStatus; createdAt: string };
type Draft = Omit<Booking, "id" | "createdAt"> & { id?: string };

const initialCabins: Cabin[] = [{ id: "c1", name: "Chalé 01", tone: "emerald" }, { id: "c2", name: "Chalé 02", tone: "amber" }];
const initialBookings: Booking[] = [];
const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const toISO = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const fromISO = (value: string) => { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day); };
const nextDay = (value: string) => { const date = fromISO(value); date.setDate(date.getDate() + 1); return toISO(date); };
const shortDate = (value: string) => fromISO(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
const rangeIncludes = (booking: Booking, value: string) => booking.start <= value && booking.end > value;
const formatSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

function makeDraft(day: string, cabins: Cabin[]): Draft { return { cabinId: cabins[0]?.id ?? "", guestName: "", people: 2, start: day, end: nextDay(day), checkIn: "14:00", checkOut: "11:00", pets: false, breakfast: true, intolerance: "", decoration: false, notes: "", documents: [], status: "Reservado" }; }
function toneClasses(tone: Cabin["tone"]) { return tone === "amber" ? "bg-[#f3e9da] text-[#906a36] border-[#e5d1af]" : tone === "violet" ? "bg-[#ece8f6] text-[#665297] border-[#d9cff0]" : tone === "rose" ? "bg-[#f7e5df] text-[#995545] border-[#edcdc4]" : "bg-[#e5efe9] text-[#347053] border-[#c9dfd0]"; }
function dotClass(tone: Cabin["tone"]) { return tone === "amber" ? "bg-[#c89e66]" : tone === "violet" ? "bg-[#8877bb]" : tone === "rose" ? "bg-[#c47b68]" : "bg-[#68a07d]"; }

export default function Home() {
  return <AuthGate><Dashboard /></AuthGate>;
}

function Dashboard() {
  const { mode, documentPrefix } = useWorkspace();
  const beta = mode === "beta";
  const [saveStatus, setSaveStatus] = useState<"loading" | "saving" | "saved" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const saveVersion = useRef(0);
  const scopedFetch = useCallback((url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    headers.set("x-refugio-mode", mode);
    return fetch(url, { ...options, headers });
  }, [mode]);
  const [cabins, setCabins] = useState<Cabin[]>(initialCabins);
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [financeEntries, setFinanceEntries] = useState<FinanceEntry[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [activeView, setActiveView] = useState<"launcher" | "overview" | "finance">("launcher");
  const [darkMode, setDarkMode] = useState(false);
  const [headerSlots, setHeaderSlots] = useState<{ brand: HTMLElement | null; tabs: HTMLElement | null; actions: HTMLElement | null }>({ brand: null, tabs: null, actions: null });
  const [notificationsMenuOpen, setNotificationsMenuOpen] = useState(false);
  const [adegaChoiceOpen, setAdegaChoiceOpen] = useState(false);
  const notificationsMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    setHeaderSlots({
      brand: document.getElementById("matto-dashboard-brand"),
      tabs: document.getElementById("matto-dashboard-tabs"),
      actions: document.getElementById("matto-dashboard-actions"),
    });
  }, []);
  useEffect(() => {
    if (!notificationsMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !notificationsMenuRef.current?.contains(event.target)) {
        setNotificationsMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotificationsMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [notificationsMenuOpen]);
  useEffect(() => {
    if (!adegaChoiceOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setAdegaChoiceOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [adegaChoiceOpen]);
  const [view, setView] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => toISO(new Date()));
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [cabinsOpen, setCabinsOpen] = useState(false);
  const [newCabinName, setNewCabinName] = useState("");
  const [notice, setNotice] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  useEffect(() => {
    const sync = () => setDarkMode(document.documentElement.classList.contains("dark"));
    const cabins = () => setCabinsOpen(true);
    const frame = requestAnimationFrame(sync);
    window.addEventListener("theme-changed", sync);
    window.addEventListener("open-cabin-settings", cabins);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("theme-changed", sync); window.removeEventListener("open-cabin-settings", cabins); };
  }, []);
  const toggleTheme = async () => {
    const next = !darkMode;
    try {
      const response = await scopedFetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "preferences", theme: next ? "dark" : "light" }) });
      if (response.status === 401) window.dispatchEvent(new Event("auth-expired"));
      if (!response.ok) throw new Error();
      const data = await response.json();
      applyTheme(effectiveTheme(data.user));
      window.dispatchEvent(new CustomEvent("account-updated", { detail: data.user }));
    } catch { setNotice("Não foi possível salvar a preferência de aparência."); }
  };

  useEffect(() => {
    scopedFetch("/api/state", { cache: "no-store" })
      .then((response) => {
        if (response.status === 401) window.dispatchEvent(new Event("auth-expired"));
        if (!response.ok) throw new Error("Não foi possível carregar os dados do MongoDB.");
        return response.json();
      })
      .then((data) => {
        setCabins(Array.isArray(data.cabins) ? data.cabins : initialCabins);
        setBookings(Array.isArray(data.bookings) ? data.bookings : initialBookings);
        setFinanceEntries(Array.isArray(data.financeEntries) ? data.financeEntries : []);
        setPayables(Array.isArray(data.payables) ? data.payables : []);
        setHydrated(true);
      })
      .catch(() => { if (beta) setSaveStatus("error"); setNotice("Não foi possível carregar os dados do MongoDB. Recarregue a página para tentar novamente; o salvamento está bloqueado para proteger os dados existentes."); });
  }, [scopedFetch, beta]);
  useEffect(() => {
    const reloadAfterRestore = async () => {
      try {
        const response = await scopedFetch("/api/state", { cache: "no-store" });
        if (!response.ok) throw new Error();
        const data = await response.json();
        setCabins(Array.isArray(data.cabins) ? data.cabins : initialCabins);
        setBookings(Array.isArray(data.bookings) ? data.bookings : initialBookings);
        setFinanceEntries(Array.isArray(data.financeEntries) ? data.financeEntries : []);
        setPayables(Array.isArray(data.payables) ? data.payables : []);
        setNotice("Backup restaurado e painel atualizado.");
      } catch { setNotice("Backup restaurado no banco. Recarregue o painel para atualizar os dados exibidos."); }
    };
    window.addEventListener("backup-restored", reloadAfterRestore);
    return () => window.removeEventListener("backup-restored", reloadAfterRestore);
  }, [scopedFetch]);
  useEffect(() => {
    if (!hydrated) return;
    const version = ++saveVersion.current;
    let cancelled = false;
    // Defer the status update so it doesn't synchronously cascade through the effect.
    const frame = beta ? requestAnimationFrame(() => setSaveStatus("saving")) : null;
    const timer = window.setTimeout(async () => {
      try {
        const response = await scopedFetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cabins, bookings, financeEntries, payables }) });
        if (response.status === 401) window.dispatchEvent(new Event("auth-expired"));
        if (!response.ok) throw new Error("Não foi possível salvar as alterações.");
        if (beta && !cancelled && version === saveVersion.current) setSaveStatus("saved");
      } catch {
        if (cancelled || version !== saveVersion.current) return;
        if (beta) setSaveStatus("error");
        setNotice(beta ? "Não foi possível salvar. Verifique sua conexão e tente novamente." : "Não foi possível salvar as alterações no MongoDB.");
      }
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); if (frame !== null) cancelAnimationFrame(frame); };
  }, [cabins, bookings, financeEntries, payables, hydrated, scopedFetch, beta, retry]);
  useEffect(() => { if (!notice || beta) return; const timer = window.setTimeout(() => setNotice(""), 3000); return () => window.clearTimeout(timer); }, [notice, beta]);

  const selectedBookings = bookings.filter((booking) => rangeIncludes(booking, selectedDay));
  const today = toISO(new Date());
  const todayBookings = bookings.filter((booking) => rangeIncludes(booking, today));
  const selected = bookings.find((booking) => booking.id === selectedId) ?? selectedBookings[0];
  const monthBookings = bookings.filter((booking) => { const first = toISO(new Date(view.getFullYear(), view.getMonth(), 1)); const last = toISO(new Date(view.getFullYear(), view.getMonth() + 1, 1)); return booking.start < last && booking.end > first; });
  const occupiedNights = (cabinId: string) => { const dates = new Set<string>(); bookings.filter((booking) => booking.cabinId === cabinId).forEach((booking) => { for (let date = fromISO(booking.start); toISO(date) < booking.end; date.setDate(date.getDate() + 1)) dates.add(toISO(date)); }); return dates.size; };

  const openNew = (day = selectedDay) => { if (beta) setNotice(""); setDraft(makeDraft(day, cabins)); };
  const openEdit = (booking: Booking) => { if (beta) setNotice(""); setDraft({ ...booking, documents: [...booking.documents] }); };
  const selectDay = (day: string) => { setSelectedDay(day); setSelectedId(bookings.find((booking) => rangeIncludes(booking, day))?.id ?? ""); };
  const updateStatus = (booking: Booking, status: BookingStatus) => { setBookings((items) => items.map((item) => item.id === booking.id ? { ...item, status } : item)); setNotice("Status da reserva atualizado."); };
  const removeBooking = (id: string) => { if (!window.confirm("Excluir esta reserva?")) return; const removed = bookings.find((item) => item.id === id); removed?.documents.forEach((document) => { if (document.pathname) scopedFetch(`/api/documents?pathname=${encodeURIComponent(document.pathname)}`, { method: "DELETE" }); }); setBookings((items) => items.filter((item) => item.id !== id)); setSelectedId(""); setDetailsOpen(false); setNotice("Reserva excluída."); };
  const saveDraft = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!draft) return; if (!draft.guestName.trim() || !draft.cabinId || !draft.start || !draft.end) return setNotice("Preencha hóspede, chalé, entrada e saída."); if (draft.end <= draft.start) return setNotice("A saída deve ser posterior à entrada."); const conflict = bookings.find((booking) => booking.id !== draft.id && booking.cabinId === draft.cabinId && booking.start < draft.end && booking.end > draft.start); if (conflict) return setNotice(`Conflito com a reserva de ${conflict.guestName}.`); const previous = draft.id ? bookings.find((item) => item.id === draft.id) : undefined; previous?.documents.filter((document) => document.pathname && !draft.documents.some((current) => current.id === document.id)).forEach((document) => scopedFetch(`/api/documents?pathname=${encodeURIComponent(document.pathname!)}`, { method: "DELETE" })); const booking: Booking = { ...draft, id: draft.id ?? crypto.randomUUID(), guestName: draft.guestName.trim(), people: Math.max(1, Number(draft.people) || 1), createdAt: draft.id ? previous?.createdAt ?? toISO(new Date()) : toISO(new Date()) }; setBookings((items) => draft.id ? items.map((item) => item.id === draft.id ? booking : item) : [...items, booking]); setSelectedDay(booking.start); setSelectedId(booking.id); setDraft(null); setNotice(draft.id ? "Reserva atualizada." : "Reserva criada e marcada no calendário."); };
  const uploadDocuments = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length || !draft) return;
    setUploadProgress(0);
    try {
      const documents: Attachment[] = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const blob = await upload(`${documentPrefix}${draft.id ?? "rascunhos"}/${crypto.randomUUID()}-${safeName}`, file, {
          access: "private",
          handleUploadUrl: "/api/blob/upload",
          multipart: file.size > 100 * 1024 * 1024,
          onUploadProgress: ({ percentage }) => setUploadProgress(Math.round(((index + percentage / 100) / files.length) * 100)),
        });
        documents.push({ id: crypto.randomUUID(), name: file.name, type: file.type || "application/octet-stream", size: file.size, pathname: blob.pathname, url: blob.url });
      }
      setDraft((current) => current ? { ...current, documents: [...current.documents, ...documents] } : current);
      setNotice(`${documents.length} arquivo(s) enviado(s) ao armazenamento privado.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível anexar o arquivo.");
    } finally {
      setUploadProgress(null);
      event.target.value = "";
    }
  };
  const removeDocument = async (document: Attachment) => {
    const alreadySaved = bookings.some((booking) => booking.documents.some((item) => item.id === document.id));
    if (document.pathname && !alreadySaved) await scopedFetch(`/api/documents?pathname=${encodeURIComponent(document.pathname)}`, { method: "DELETE" });
    setDraft((current) => current ? { ...current, documents: current.documents.filter((item) => item.id !== document.id) } : current);
  };
  const addCabin = () => { const name = newCabinName.trim(); if (!name) return; const tones: Cabin["tone"][] = ["violet", "rose", "emerald", "amber"]; setCabins((items) => [...items, { id: crypto.randomUUID(), name, tone: tones[items.length % tones.length] }]); setNewCabinName(""); setNotice("Novo chalé adicionado."); };
  const renameCabin = (id: string, name: string) => { if (!name.trim()) return; setCabins((items) => items.map((item) => item.id === id ? { ...item, name: name.trim() } : item)); };
  const canManageAccounts = headerSlots.actions?.dataset.canManageAccounts === "true";

  return <BetaFeedbackContext.Provider value={{ message: beta ? notice : "", dismiss: () => setNotice("") }}><main className="min-h-screen bg-[#fffefa] text-[#22322b]"><section className="min-h-screen w-full overflow-hidden bg-[#fffefa]">

    {headerSlots.tabs && createPortal(<div className="matto-dashboard-tabs"><GlassTabs tint={0} value={activeView === "finance" ? "finance" : "launcher"} onValueChange={next => setActiveView(next)} label="Seções administrativas" options={[{ value: "launcher", label: "Home", icon: <LayoutDashboard size={13} /> }, { value: "finance", label: "Financeiro", icon: <WalletCards size={13} /> }]} /></div>, headerSlots.tabs)}
    {headerSlots.actions && createPortal(
      <div className="matto-dashboard-actions">
        <div ref={notificationsMenuRef} className="relative">
          <GlassButton variant="icon" tint={0.25} aria-label="Abrir menu principal" title="Menu principal" aria-haspopup="menu" aria-expanded={notificationsMenuOpen} aria-controls="main-glass-menu" onClick={() => setNotificationsMenuOpen((open) => !open)}><Ellipsis className="size-5" /></GlassButton>
          {notificationsMenuOpen && <div id="main-glass-menu" className="absolute right-0 top-[calc(100%+6px)] z-[90] w-64" role="menu" aria-label="Menu principal">
            <Glass strength={0.3} blur={7} tint={0.16} dome={0.14} radius={18} className="border border-white/25 bg-white/10 shadow-[0_18px_42px_rgba(0,0,0,.28)] dark:border-white/10 dark:bg-[#142019]/45" contentClassName={`relative z-10 grid gap-1 p-2 ${darkMode ? "text-white" : "text-[#22322b]"}`}>
              <button type="button" role="menuitem" onClick={() => { setNotificationsMenuOpen(false); setActiveView("overview"); }} className="flex h-10 items-center gap-3 rounded-xl px-3 text-left text-xs font-semibold text-inherit transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75b793] dark:hover:bg-white/10"><CalendarDays size={16} /> Reservas</button>
              <button type="button" role="menuitem" onClick={() => { setNotificationsMenuOpen(false); setAdegaChoiceOpen(true); }} className="flex h-10 items-center gap-3 rounded-xl px-3 text-left text-xs font-semibold text-inherit transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75b793] dark:hover:bg-white/10"><Wine size={16} /> Adega</button>
              <button type="button" role="menuitem" onClick={() => { setNotificationsMenuOpen(false); setActiveView("overview"); setView(new Date()); setSelectedDay(toISO(new Date())); }} className="flex h-10 items-center gap-3 rounded-xl px-3 text-left text-xs font-semibold text-inherit transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75b793] dark:hover:bg-white/10"><Clock3 size={16} /> Agendamentos</button>
              <div role="separator" className="my-1 h-px bg-black/10 dark:bg-white/15" />
              {canManageAccounts && <button type="button" role="menuitem" onClick={() => { setNotificationsMenuOpen(false); window.dispatchEvent(new Event("open-accounts-panel")); }} className="flex h-10 items-center gap-3 rounded-xl px-3 text-left text-xs font-semibold text-inherit transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75b793] dark:hover:bg-white/10"><Users size={16} /> Contas</button>}
              <button type="button" role="menuitem" onClick={() => { setNotificationsMenuOpen(false); window.dispatchEvent(new Event("open-settings-panel")); }} className="flex h-10 items-center gap-3 rounded-xl px-3 text-left text-xs font-semibold text-inherit transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75b793] dark:hover:bg-white/10"><Settings size={16} /> Configurações</button>
              <button type="button" role="menuitemcheckbox" aria-checked={darkMode} onClick={() => { setNotificationsMenuOpen(false); toggleTheme(); }} className="flex h-10 items-center gap-3 rounded-xl px-3 text-left text-xs font-semibold text-inherit transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75b793] dark:hover:bg-white/10">{darkMode ? <Sun size={16} /> : <Moon size={16} />} {darkMode ? "Modo claro" : "Modo escuro"}</button>
              <div role="separator" className="my-1 h-px bg-black/10 dark:bg-white/15" />
              <button type="button" role="menuitem" onClick={() => { setNotificationsMenuOpen(false); window.dispatchEvent(new Event("open-cabin-settings")); }} className="flex h-10 items-center gap-3 rounded-xl px-3 text-left text-xs font-semibold text-inherit transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75b793] dark:hover:bg-white/10"><Settings2 size={16} /> Chalés</button>
              <button type="button" role="menuitem" onClick={() => { setNotificationsMenuOpen(false); setActiveView("overview"); openNew(); }} className="flex h-10 items-center gap-3 rounded-xl px-3 text-left text-xs font-semibold text-inherit transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75b793] dark:hover:bg-white/10"><Plus size={16} /> Nova reserva</button>
              <div role="separator" className="my-1 h-px bg-black/10 dark:bg-white/15" />
              <button type="button" role="menuitem" onClick={() => { setNotificationsMenuOpen(false); window.dispatchEvent(new Event("request-auth-logout")); }} className="flex h-10 items-center gap-3 rounded-xl px-3 text-left text-xs font-semibold text-[#a14b40] transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 dark:text-[#ffaaa0]"><LogOut size={16} /> Sair</button>
            </Glass>
          </div>}
        </div>
      </div>, headerSlots.actions)}    {beta && <div className="beta-save-status" role="status" aria-live="polite"><span>{saveStatus === "loading" ? "Carregando dados de teste…" : saveStatus === "saving" ? "Salvando alterações de teste…" : saveStatus === "saved" ? "Alterações de teste salvas" : "Alterações não confirmadas — confira sua conexão"}</span>{saveStatus === "error" && <button onClick={() => hydrated ? setRetry(value => value + 1) : window.location.reload()}>Tentar novamente</button>}</div>}
    {notice && (beta ? <div className="beta-notice" role="status" aria-live="polite"><span>{notice}</span><button aria-label="Dispensar mensagem" onClick={() => setNotice("")}><X size={18} /></button></div> : <div className="fixed right-5 top-5 z-50 rounded-xl bg-[#1f4b3a] px-4 py-3 text-xs font-bold text-white shadow-xl">{notice}</div>)}
    {activeView === "launcher" ? <HomeLauncher reservationCount={monthBookings.length} cabinCount={cabins.length} todayCount={todayBookings.length} todayLabel={new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })} onReservations={() => setActiveView("overview")} onCellar={() => setAdegaChoiceOpen(true)} onSchedule={() => { const date = new Date(); setView(date); setSelectedDay(toISO(date)); setActiveView("overview"); }} /> : activeView === "overview" ? <div className={`overview-calendar-layout grid transition-[grid-template-columns] duration-500 ease-in-out ${selectedBookings.length ? "lg:grid-cols-[minmax(0,1.65fr)_minmax(370px,.78fr)]" : "lg:grid-cols-[minmax(0,1fr)_minmax(0,0fr)]"}`}><section className="p-5 md:p-8"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold tracking-[.14em] text-[#758078]">AGENDA DE OCUPAÇÃO</p><h2 className="mt-1 text-2xl font-bold tracking-[-.055em] md:text-[28px]">{monthNames[view.getMonth()]} <span className="font-medium text-[#7d877f]">{view.getFullYear()}</span></h2></div><div className="flex gap-2"><button onClick={() => { setView(new Date()); setSelectedDay(toISO(new Date())); }} className="h-9 rounded-lg border border-[#e4e3dc] bg-white px-3 text-[11px] font-bold text-[#58645d]">Hoje</button><div className="flex overflow-hidden rounded-lg border border-[#e4e3dc]"><button onClick={() => setView((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))} className="grid h-9 w-9 place-items-center border-r border-[#e4e3dc] bg-white" aria-label="Mês anterior"><ChevronLeft size={18} /></button><button onClick={() => setView((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))} className="grid h-9 w-9 place-items-center bg-white" aria-label="Próximo mês"><ChevronRight size={18} /></button></div></div></div>
      <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex flex-wrap gap-3 text-[10px] text-[#6d7770]">{cabins.map((cabin) => <span key={cabin.id} className="flex items-center gap-1.5"><i className={`h-2 w-2 rounded-full ${dotClass(cabin.tone)}`} /> {beta ? `C${cabins.indexOf(cabin) + 1} · ${cabin.name}` : cabin.name}</span>)}</div><GlassTabs tint={0} value={filter} onValueChange={setFilter} label="Filtrar calendário por chalé" options={[{ value: "all", label: "Todos" }, ...cabins.map(cabin => ({ value: cabin.id, label: cabin.name }))]} /></div>
      <div className="mt-6">
        <GlassCalendar
          month={view}
          onMonthChange={setView}
          selected={fromISO(selectedDay)}
          onSelect={date => selectDay(toISO(date))}
          hideNavigation
          schedule
          dayContent={(date) => {
            const iso = toISO(date);
            const visible = bookings.filter((booking) => rangeIncludes(booking, iso) && (filter === "all" || booking.cabinId === filter));
            return <span className="glass-schedule-day-content">
              <span className="glass-schedule-day-number">{date.getDate()}</span>
              {visible.length > 0 && <>
                <span className="glass-schedule-day-dots" aria-hidden="true">{visible.slice(0, 2).map(booking => { const cabin = cabins.find(item => item.id === booking.cabinId); return <i key={booking.id} className={cabin ? dotClass(cabin.tone) : "bg-slate-400"} />; })}</span>
                <span className="calendar-reservation-preview" aria-hidden="true">{visible.slice(0, 2).map(booking => { const cabin = cabins.find(item => item.id === booking.cabinId); return <span key={booking.id} className={`calendar-reservation-preview-item ${cabin ? toneClasses(cabin.tone) : ""}`}>{cabin?.name} · {booking.guestName.split(" ")[0]}</span>; })}{visible.length > 2 && <span className="calendar-reservation-preview-item calendar-reservation-preview-more">+{visible.length - 2} reservas</span>}</span>
                <span className="sr-only">{visible.length} reserva(s): {visible.map(booking => `${cabins.find(item => item.id === booking.cabinId)?.name}, ${booking.guestName}`).join("; ")}</span>
              </>}
            </span>;
          }}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 md:mt-3 md:grid-cols-4"><Metric label="Reservas no mês" value={String(monthBookings.length)} note="inclui entradas e saídas" /><Metric label={`${cabins[0]?.name ?? "Chalé 01"} ocupado`} value={`${occupiedNights(cabins[0]?.id ?? "")} noites`} note="agenda atual" /><Metric label={`${cabins[1]?.name ?? "Chalé 02"} ocupado`} value={`${occupiedNights(cabins[1]?.id ?? "")} noites`} note="agenda atual" /><Metric label="Chalés ativos" value={String(cabins.length)} note="edite ou adicione unidades" /></div>
    </section>
    <aside aria-hidden={!selectedBookings.length} inert={!selectedBookings.length} className={`selected-day-panel min-w-0 overflow-hidden border-t bg-[#fdfcf8] transition-[opacity,transform,padding] duration-500 ease-in-out lg:border-t-0 lg:transition-[opacity,transform,padding,border-color] ${selectedBookings.length ? "translate-x-0 border-[#e4e3dc] p-5 opacity-100 md:p-8 lg:border-l" : "pointer-events-none translate-x-4 border-transparent p-0 opacity-0 lg:border-l-transparent"}`}><div className="flex items-start justify-between"><div><p className="text-[9px] font-bold tracking-[.14em] text-[#758078]">DIA SELECIONADO</p><h2 className="mt-1 text-[21px] font-bold capitalize tracking-[-.05em]">{fromISO(selectedDay).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}</h2></div><button onClick={() => openNew(selectedDay)} className="grid h-9 w-9 place-items-center rounded-lg border border-[#e4e3dc] bg-white text-[#1f4b3a]" aria-label="Reservar esta data"><Plus size={17} /></button></div><p className="mt-3 text-[11px] text-[#7a837c]">{selectedBookings.length ? `${selectedBookings.length} reserva(s) ocupando esta data.` : "Data livre. Você pode criar uma reserva para este dia."}</p><div className="mt-5 grid gap-2">{selectedBookings.map((booking) => { const cabin = cabins.find((item) => item.id === booking.cabinId); return <button onClick={() => { setSelectedId(booking.id); setDetailsOpen(true); }} key={booking.id} className="grid grid-cols-[38px_1fr_auto] items-center gap-2.5 rounded-xl border border-[#c7ded0] bg-[#f0f7f2] p-2.5 text-left"><span className={`grid h-[38px] w-[38px] place-items-center rounded-xl text-[10px] font-bold ${cabin ? toneClasses(cabin.tone) : ""}`}>{booking.guestName.split(" ").map((name) => name[0]).slice(0, 2).join("")}</span><span><b className="block text-[12px]">{booking.guestName}</b><small className="mt-1 block text-[10px] text-[#778078]">{cabin?.name} · {booking.people} pessoas</small></span><span className="rounded-full bg-[#deeee4] px-2 py-1 text-[8px] font-bold text-[#367254]">{booking.status}</span></button>; })}</div>{!selectedBookings.length && <button onClick={() => openNew(selectedDay)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#b7ccbc] bg-white py-4 text-xs font-bold text-[#1f4b3a]"><Plus size={15} /> Reservar esta data</button>}
      {selected && <GlassCard tint={0} className="selected-booking-glass mt-5 rounded-2xl border border-[#e4e3dc]">
        <GlassCardHeader className="selected-booking-header">
          <div>
            <GlassCardDescription className="selected-booking-eyebrow">RESERVA SELECIONADA</GlassCardDescription>
            <GlassCardTitle className="selected-booking-title">{selected.guestName}</GlassCardTitle>
          </div>
          <button onClick={() => openEdit(selected)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#edf3ee] text-[#1f4b3a]" aria-label="Editar reserva"><Pencil size={13} /></button>
        </GlassCardHeader>
        <GlassCardContent className="selected-booking-content">
          <div className="mt-4 grid grid-cols-2 gap-3 text-[10px]"><Detail label="Entrada" value={`${shortDate(selected.start)} · ${selected.checkIn}`} /><Detail label="Saída" value={`${shortDate(selected.end)} · ${selected.checkOut}`} /><Detail label="Pessoas" value={`${selected.people} hóspedes`} /><Detail label="Documentos" value={`${selected.documents.length} anexo(s)`} /></div>
          <button onClick={() => setDetailsOpen(true)} className="mt-4 flex w-full items-center justify-between border-t border-[#e4e3dc] pt-3 text-[10px] font-bold text-[#1f4b3a]">Abrir detalhes da reserva <ArrowRight size={14} /></button>
        </GlassCardContent>
      </GlassCard>}</aside>
    </div> : <FinancePanel entries={financeEntries} onChange={setFinanceEntries} payables={payables} onPayablesChange={setPayables} onNotice={setNotice} />}
  </section>
  {draft && <BookingModal draft={draft} cabins={cabins} setDraft={setDraft} onClose={() => setDraft(null)} onSave={saveDraft} onUpload={uploadDocuments} onRemoveDocument={removeDocument} uploadProgress={uploadProgress} />}
  {detailsOpen && selected && <BookingDetails booking={selected} cabin={cabins.find((item) => item.id === selected.cabinId)} onClose={() => setDetailsOpen(false)} onEdit={() => { setDetailsOpen(false); openEdit(selected); }} onDelete={() => removeBooking(selected.id)} onStatus={updateStatus} />}
  {cabinsOpen && <CabinModal cabins={cabins} newName={newCabinName} onName={setNewCabinName} onAdd={addCabin} onRename={renameCabin} onClose={() => setCabinsOpen(false)} />}
</main>{adegaChoiceOpen && typeof document !== "undefined" && createPortal(<div className="fixed inset-0 z-[200] grid place-items-center bg-black/35 px-4 py-6 backdrop-blur-md" onMouseDown={event => { if (event.target === event.currentTarget) setAdegaChoiceOpen(false); }}><Glass strength={0.12} blur={12} tint={0.1} dome={0.08} radius={24} className="w-full max-w-md border border-white/20 bg-white/[0.08] shadow-[0_24px_80px_rgba(0,0,0,.35)] dark:border-white/15 dark:bg-[#142019]/35" contentClassName={`relative z-10 p-6 sm:p-7 ${darkMode ? "text-white" : "text-[#22322b]"}`}><div role="dialog" aria-modal="true" aria-labelledby="adega-choice-title"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#75b793]">Adega</p><h2 id="adega-choice-title" className="mt-2 text-xl font-bold tracking-tight">O que você deseja abrir?</h2><p className="mt-1 text-sm text-current/70">Escolha uma área para continuar.</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><a href="https://matto-chales.vercel.app" onClick={() => setAdegaChoiceOpen(false)} className="group flex min-h-28 flex-col items-start justify-between rounded-2xl border border-white/20 bg-white/[.08] p-4 transition hover:bg-white/[.15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75b793]"><Wine size={21} className="text-[#75b793]" /><span><strong className="block text-sm">Loja</strong><small className="mt-1 block text-xs text-current/65">Abrir a loja pública da adega</small></span></a><a href="https://matto-chales.vercel.app/admin" onClick={() => setAdegaChoiceOpen(false)} className="flex min-h-28 flex-col items-start justify-between rounded-2xl border border-white/20 bg-white/[.08] p-4 text-left transition hover:bg-white/[.15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75b793]"><Boxes size={21} className="text-[#75b793]" /><span><strong className="block text-sm">Inventário</strong><small className="mt-1 block text-xs text-current/65">Gerenciar itens cadastrados</small></span></a></div><button type="button" autoFocus onClick={() => setAdegaChoiceOpen(false)} className="mt-5 min-h-10 w-full rounded-xl border border-white/20 bg-white/[.06] text-sm font-semibold text-current/80 transition hover:bg-white/[.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75b793]">Fechar</button></div></Glass></div>, document.body)}</BetaFeedbackContext.Provider>;
}


function GlassTimePicker({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const hourList = useRef<HTMLDivElement>(null);
  const minuteList = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [hour, minute] = (value || "14:00").split(":").map((part) => Number(part) || 0);
  const selectedTime = useRef({ hour, minute });
  selectedTime.current = { hour, minute };
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      if (hourList.current) hourList.current.scrollTop = selectedTime.current.hour * 32;
      if (minuteList.current) minuteList.current.scrollTop = selectedTime.current.minute * 32;
    });
    const outside = (event: PointerEvent) => { const target = event.target as Node; if (!panel.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key !== "Escape") return; event.preventDefault(); event.stopImmediatePropagation(); setOpen(false); trigger.current?.focus(); };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape, true);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("pointerdown", outside, true); document.removeEventListener("keydown", escape, true); };
  }, [open]);
  const setTimePart = (nextHour: number, nextMinute: number) => onChange(`${String((nextHour + 24) % 24).padStart(2, "0")}:${String((nextMinute + 60) % 60).padStart(2, "0")}`);
  const hours = Array.from({ length: 24 }, (_, index) => index);
  const minutes = Array.from({ length: 60 }, (_, index) => index);
  const renderWheel = (title: string, values: number[], selected: number, listRef: React.RefObject<HTMLDivElement | null>, onPick: (value: number) => void) => <div className="min-w-0 flex-1">
    <p className="mb-1 text-center text-[9px] font-semibold uppercase tracking-[.12em] text-white/55">{title}</p>
    <div className="relative h-40 overflow-hidden rounded-xl border border-white/10 bg-black/10">
      <div ref={listRef} role="listbox" aria-label={title} tabIndex={0} onScroll={(event) => { const index = Math.max(0, Math.min(values.length - 1, Math.round(event.currentTarget.scrollTop / 32))); if (index !== selected) onPick(index); }} className="relative z-[1] h-full overflow-y-auto py-16 text-center [scrollbar-width:none] [scroll-snap-type:y_mandatory] [&::-webkit-scrollbar]:hidden">
        {values.map((item) => <button key={item} type="button" role="option" aria-selected={item === selected} onClick={() => { onPick(item); listRef.current?.scrollTo({ top: item * 32, behavior: "smooth" }); }} className={`flex h-8 w-full snap-center items-center justify-center text-sm tabular-nums transition ${item === selected ? "font-semibold text-white" : "text-white/45 hover:text-white/75"}`}>{String(item).padStart(2, "0")}</button>)}
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-1 top-1/2 z-[2] h-8 -translate-y-1/2 rounded-lg border border-white/25 bg-white/[.08] shadow-[inset_0_1px_0_rgba(255,255,255,.08)]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-[3] h-12 bg-gradient-to-b from-[#172b28]/70 to-transparent" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-12 bg-gradient-to-t from-[#172b28]/70 to-transparent" />
    </div>
  </div>;
  return <div className={`relative ${open ? "z-[130]" : ""}`}>
    <button ref={trigger} type="button" aria-label={`${label}: ${value}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(current => !current)} className="glass-time-trigger flex h-10 w-full items-center justify-between rounded-lg border border-white/15 bg-white/[.04] px-3 text-left text-xs font-semibold text-white outline-none transition hover:bg-white/[.08] focus-visible:ring-2 focus-visible:ring-[#75a385]/40">
      <span className="tabular-nums">{value}</span><Clock3 size={15} className="shrink-0 text-white/70" aria-hidden="true" />
    </button>
    {open && <GlassSurface ref={panel} role="dialog" aria-label={`Selecionar ${label.toLocaleLowerCase()}`} className="glass-time-popup absolute z-[110] overflow-hidden border border-white/20 text-white shadow-[0_18px_50px_rgba(0,0,0,.42)]" contentClassName="p-2" style={{ position: "absolute", left: 0, top: "calc(100% + 5px)", width: 204, maxHeight: 204 }} tint={0.22} blur={18} saturation={1.65} radius={16} specular>
      <div className="flex gap-2">{renderWheel("Hora", hours, hour, hourList, (next) => setTimePart(next, minute))}<div className="mt-5 flex h-40 items-center text-lg text-white/35">:</div>{renderWheel("Minuto", minutes, minute, minuteList, (next) => setTimePart(hour, next))}</div>
    </GlassSurface>}
  </div>;
}
function GuestStepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const min = 1;
  const max = 30;
  const current = useRef(value);
  const repeat = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { current.current = value; }, [value]);
  const set = useCallback((next: number) => {
    const clamped = Math.min(max, Math.max(min, next));
    if (clamped === current.current) return false;
    current.current = clamped;
    onChange(clamped);
    return true;
  }, [onChange]);
  const stop = useCallback(() => {
    if (repeat.current) clearTimeout(repeat.current);
    repeat.current = null;
  }, []);
  useEffect(() => stop, [stop]);
  const press = (event: React.PointerEvent<HTMLButtonElement>, direction: -1 | 1) => {
    if (event.button !== 0) return;
    const amount = direction * (event.shiftKey ? 10 : 1);
    set(current.current + amount);
    const tick = (delay: number) => {
      repeat.current = setTimeout(() => {
        if (set(current.current + amount)) tick(90);
        else repeat.current = null;
      }, delay);
    };
    tick(420);
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const amount = event.shiftKey ? 10 : 1;
    const keys: Record<string, number | undefined> = {
      ArrowUp: amount, ArrowRight: amount, ArrowDown: -amount, ArrowLeft: -amount,
      PageUp: 10, PageDown: -10,
    };
    if (event.key === "Home") set(min);
    else if (event.key === "End") set(max);
    else if (keys[event.key] !== undefined) set(value + keys[event.key]!);
    else return;
    event.preventDefault();
  };
  return <div role="spinbutton" tabIndex={0} aria-label="Quantidade de pessoas" aria-valuenow={value} aria-valuemin={min} aria-valuemax={max} onKeyDown={onKeyDown} className={`flex h-10 w-full items-center justify-between rounded-lg border border-[#dcded8] bg-white px-3 text-xs outline-none transition focus-within:border-[#75a385] text-white focus-visible:ring-2 focus-visible:ring-[#75a385]/30`}>
    <output aria-hidden="true" className="min-w-5 font-semibold tabular-nums">{value}</output>
    <div className="inline-flex h-6 overflow-hidden rounded-full border border-white/25 bg-white/10 text-white/90 shadow-inner backdrop-blur-md">
      <button type="button" tabIndex={-1} aria-label="Diminuir quantidade" disabled={value <= min} onPointerDown={(event) => press(event, -1)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} className="flex w-6 items-center justify-center text-xs transition hover:bg-white/15 active:bg-white/25 disabled:cursor-not-allowed disabled:opacity-35">−</button>
      <span aria-hidden="true" className="my-1 w-px bg-white/25" />
      <button type="button" tabIndex={-1} aria-label="Aumentar quantidade" disabled={value >= max} onPointerDown={(event) => press(event, 1)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} className="flex w-6 items-center justify-center text-xs transition hover:bg-white/15 active:bg-white/25 disabled:cursor-not-allowed disabled:opacity-35">+</button>
    </div>
  </div>;
}
function HomeLauncher({ reservationCount, cabinCount, todayCount, todayLabel, onReservations, onCellar, onSchedule }: { reservationCount: number; cabinCount: number; todayCount: number; todayLabel: string; onReservations: () => void; onCellar: () => void; onSchedule: () => void }) {
  const cards = [
    { id: "reservas", eyebrow: "HOSPEDAGENS", title: "Reservas", description: "Consulte a agenda de ocupação, acompanhe estadias e organize novas reservas em um só lugar.", icon: <CalendarDays size={23} />, detail: `${reservationCount} reserva(s) neste mês`, action: "Abrir calendário", onClick: onReservations, tint: .14 },
    { id: "adega", eyebrow: "LOJA & ESTOQUE", title: "Adega", description: "Acesse a loja para hóspedes ou abra o inventário para gerenciar os itens cadastrados.", icon: <Wine size={23} />, detail: "Loja pública · Inventário", action: "Escolher área", onClick: onCellar, tint: .18 },
    { id: "agendamentos", eyebrow: "ACOMPANHAMENTO", title: "Agendamentos", description: "Veja o que acontece hoje: entradas, saídas e hóspedes com estadia em andamento.", icon: <Clock3 size={23} />, detail: `${todayCount} reserva(s) para hoje`, action: "Ver agenda de hoje", onClick: onSchedule, tint: .12 },
  ];
  return <section aria-labelledby="launcher-title" className="launcher-screen min-h-[calc(100dvh-76px)] px-5 py-8 text-[#22322b] dark:text-[#edf5f0] sm:px-8 sm:py-10 lg:px-12">
    <div className="mx-auto flex w-full max-w-[1440px] flex-col">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-[#dce5de]/70 pb-7 dark:border-white/10 md:pb-9">
        <div className="max-w-2xl"><span className="inline-flex items-center gap-2 rounded-full border border-[#b7ccbc]/70 bg-white/45 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[#347053] backdrop-blur-md dark:border-white/10 dark:bg-white/[.04] dark:text-[#9bd2b1]"><span className="size-1.5 rounded-full bg-[#6aa983]" /> Matto Chalés · Painel de gestão</span><h1 id="launcher-title" className="mt-5 text-3xl font-bold tracking-[-.055em] sm:text-4xl lg:text-5xl">Bem-vindo de volta</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#68756d] dark:text-[#aab9af] sm:text-base">O que você deseja abrir hoje? Escolha uma área para continuar sua gestão.</p></div>
        <div className="rounded-2xl border border-[#dce5de] bg-white/45 px-4 py-3 text-right shadow-sm backdrop-blur-lg dark:border-white/10 dark:bg-white/[.04]"><span className="block text-[9px] font-bold uppercase tracking-[.13em] text-[#7a8980] dark:text-[#97aa9d]">Hoje</span><span className="mt-1 block text-sm font-semibold capitalize text-[#31443a] dark:text-[#e6efe9]">{todayLabel}</span></div>
      </header>
      <div className="mt-7 grid gap-4 md:grid-cols-3">
        <div className="flex items-center gap-3 rounded-2xl border border-[#dce5de]/80 bg-white/35 px-4 py-3 backdrop-blur-md dark:border-white/[.08] dark:bg-white/[.025]"><span className="grid size-9 place-items-center rounded-xl bg-[#e7f0e9] text-[#347053] dark:bg-[#1b3829] dark:text-[#9bd2b1]"><CalendarDays size={17} /></span><span><b className="block text-sm">{reservationCount}</b><small className="text-[10px] text-[#78867d] dark:text-[#9aac9f]">reservas no mês</small></span></div>
        <div className="flex items-center gap-3 rounded-2xl border border-[#dce5de]/80 bg-white/35 px-4 py-3 backdrop-blur-md dark:border-white/[.08] dark:bg-white/[.025]"><span className="grid size-9 place-items-center rounded-xl bg-[#e7f0e9] text-[#347053] dark:bg-[#1b3829] dark:text-[#9bd2b1]"><Wine size={17} /></span><span><b className="block text-sm">{cabinCount}</b><small className="text-[10px] text-[#78867d] dark:text-[#9aac9f]">chalés cadastrados</small></span></div>
        <div className="flex items-center gap-3 rounded-2xl border border-[#dce5de]/80 bg-white/35 px-4 py-3 backdrop-blur-md dark:border-white/[.08] dark:bg-white/[.025]"><span className="grid size-9 place-items-center rounded-xl bg-[#e7f0e9] text-[#347053] dark:bg-[#1b3829] dark:text-[#9bd2b1]"><Clock3 size={17} /></span><span><b className="block text-sm">{todayCount}</b><small className="text-[10px] text-[#78867d] dark:text-[#9aac9f]">reservas hoje</small></span></div>
      </div>
      <section aria-label="Escolha uma área" className="mt-5 grid gap-4 md:grid-cols-2 xl:mt-6 xl:grid-cols-3">
        {cards.map(card => <Glass key={card.id} strength={.14} blur={16} tint={card.tint} dome={.08} radius={26} className="launcher-glass-card min-w-0 border border-white/25 bg-white/[.08] shadow-[0_18px_55px_rgba(9,25,17,.08)] dark:border-white/[.12] dark:bg-white/[.035] dark:shadow-[0_18px_60px_rgba(0,0,0,.16)]" contentClassName="relative z-10 h-full"><button type="button" onClick={card.onClick} className="group relative flex min-h-[255px] w-full flex-col items-stretch justify-between overflow-hidden rounded-[25px] p-5 text-left text-inherit outline-none transition duration-300 hover:-translate-y-1 hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-[#75b793] dark:hover:bg-white/[.045] sm:min-h-[290px] sm:p-7"><span aria-hidden="true" className={`launcher-card-orb launcher-card-orb-${card.id}`} /><span className="relative z-10 flex items-start justify-between"><span className="grid size-12 place-items-center rounded-2xl border border-[#6fa584]/25 bg-[#e7f0e9]/80 text-[#347053] shadow-sm backdrop-blur-md dark:border-[#8ac2a2]/20 dark:bg-[#1c3b2c]/80 dark:text-[#a5d8b9]">{card.icon}</span><span className="rounded-full border border-[#dce5de] bg-white/45 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-[#64776b] backdrop-blur dark:border-white/10 dark:bg-white/[.04] dark:text-[#a9c1b1]">{card.eyebrow}</span></span><span className="relative z-10 mt-8 block"><strong className="block text-2xl font-bold tracking-[-.045em] sm:text-[28px]">{card.title}</strong><span className="mt-2 block max-w-sm text-[13px] leading-6 text-[#68756d] dark:text-[#aab9af]">{card.description}</span></span><span className="relative z-10 mt-7 flex items-center justify-between border-t border-[#dce5de]/80 pt-4 dark:border-white/10"><span><b className="block text-[11px] font-semibold">{card.action}</b><small className="mt-1 block text-[10px] text-[#7b8980] dark:text-[#98aa9d]">{card.detail}</small></span><span className="grid size-10 place-items-center rounded-full border border-[#cbd9cf] bg-white/50 text-[#347053] transition duration-300 group-hover:translate-x-1 group-hover:bg-[#e7f0e9] dark:border-white/10 dark:bg-white/[.04] dark:text-[#a5d8b9] dark:group-hover:bg-[#1c3b2c]"><ArrowRight size={17} /></span></span></button></Glass>)}
      </section>
      <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#dce5de]/70 pt-5 text-[10px] text-[#7a8980] dark:border-white/10 dark:text-[#91a398]"><span>Seu espaço de gestão, simples e organizado.</span><span>{cabinCount} unidades · {todayCount} estadia(s) hoje</span></footer>
    </div></section>;
}
function BookingModal({ draft, cabins, setDraft, onClose, onSave, onUpload, onRemoveDocument, uploadProgress }: { draft: Draft; cabins: Cabin[]; setDraft: (value: Draft) => void; onClose: () => void; onSave: (event: FormEvent<HTMLFormElement>) => void; onUpload: (event: ChangeEvent<HTMLInputElement>) => void; onRemoveDocument: (document: Attachment) => void; uploadProgress: number | null }) { const beta = useWorkspace().mode === "beta"; const field = (key: keyof Draft, value: string | boolean | number) => setDraft({ ...draft, [key]: value }); return <Modal onClose={onClose} className="booking-edit-dialog"><form onSubmit={onSave}><div className="flex items-start justify-between pr-9"><div><p className="text-[9px] font-bold tracking-[.14em] text-[#758078]">{draft.id ? "EDITAR RESERVA" : "NOVA RESERVA"}</p><h2 className="mt-1 text-2xl font-bold tracking-[-.05em]">{draft.id ? "Atualize a estadia" : "Marque uma nova estadia"}</h2></div></div><div className="mt-5 grid gap-3"><Field label="Nome do responsável"><input required value={draft.guestName} onChange={(event) => field("guestName", event.target.value)} placeholder="Ex.: Maria Silva" /></Field><div className="grid grid-cols-2 gap-3"><Field label="Chalé"><GlassSelectMenu ariaLabel="Chalé" value={draft.cabinId} options={cabins.map((cabin) => ({ value: cabin.id, label: cabin.name }))} onChange={(value) => field("cabinId", value)} inlineMenu /></Field><Field label="Quantidade de pessoas"><GuestStepper value={Number(draft.people) || 1} onChange={(value) => field("people", value)} /></Field></div><div className="grid grid-cols-2 gap-3"><Field label="Entrada"><GlassDatePicker label="Data de entrada" value={draft.start} onChange={(value) => field("start", value)} /></Field><Field label="Saída"><GlassDatePicker label="Data de saída" value={draft.end} onChange={(value) => field("end", value)} /></Field><Field label="Horário de entrada"><GlassTimePicker label="Horário de entrada" value={draft.checkIn} onChange={(value) => field("checkIn", value)} /></Field><Field label="Horário de saída"><GlassTimePicker label="Horário de saída" value={draft.checkOut} onChange={(value) => field("checkOut", value)} /></Field></div><p className="text-[10px] text-[#758078]">A data de saída libera o chalé para uma nova entrada no mesmo dia.</p><div className="grid grid-cols-2 gap-2"><Switch label="Leva pets" icon={<Dog size={14} />} checked={draft.pets} onChange={(value) => field("pets", value)} /><Switch label="Café da manhã" icon={<Coffee size={14} />} checked={draft.breakfast} onChange={(value) => field("breakfast", value)} /><Switch label="Decoração" icon={<PartyPopper size={14} />} checked={draft.decoration} onChange={(value) => field("decoration", value)} /><Switch label="Status reservado" icon={<CalendarDays size={14} />} checked={draft.status !== "Finalizada"} onChange={(value) => field("status", value ? "Reservado" : "Finalizada")} /></div><Field label="Intolerâncias ou restrições do café"><input value={draft.intolerance} onChange={(event) => field("intolerance", event.target.value)} placeholder="Ex.: lactose, glúten, castanhas" /></Field><Field label="Observações"><textarea value={draft.notes} onChange={(event) => field("notes", event.target.value)} placeholder="Pedidos especiais, pets, pagamento, decoração..." /></Field><div className="rounded-xl border border-dashed border-[#b7ccbc] bg-[#fbfdfb] p-3"><label tabIndex={beta ? 0 : undefined} role={beta ? "button" : undefined} onKeyDown={beta ? event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.querySelector("input")?.click(); } } : undefined} className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#e7f0e9] py-2.5 text-[11px] font-bold text-[#1f4b3a]"><Upload size={15} /> {uploadProgress === null ? "Anexar documentos" : `Enviando… ${uploadProgress}%`}<input type="file" multiple disabled={uploadProgress !== null} className="hidden" onChange={onUpload} /></label><p className="mt-2 text-center text-[9px] text-[#758078]">{beta ? "Anexe imagens, PDF, ZIP e outros arquivos. O envio é privado e aceita arquivos grandes." : "Imagens, PDF, ZIP e outros formatos. Arquivos grandes usam envio multipart direto e privado."}</p>{draft.documents.length > 0 && <div className="mt-3 grid gap-2">{draft.documents.map((document) => <div key={document.id} className="flex items-center justify-between rounded-lg bg-white px-2.5 py-2 text-[10px]"><span className="flex min-w-0 items-center gap-2 truncate"><FileText size={14} className="shrink-0 text-[#1f4b3a]" /> <b className="truncate">{document.name}</b></span><button type="button" onClick={() => onRemoveDocument(document)} aria-label={beta ? `Remover ${document.name}` : undefined} className="text-[#a65746]"><X size={14} /></button></div>)}</div>}</div></div><button className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1f4b3a] text-xs font-bold text-white"><Save size={15} /> {draft.id ? "Salvar alterações" : "Salvar e marcar no calendário"}</button></form></Modal>; }
function BookingDetails({ booking, cabin, onClose, onEdit, onDelete, onStatus }: { booking: Booking; cabin?: Cabin; onClose: () => void; onEdit: () => void; onDelete: () => void; onStatus: (booking: Booking, status: BookingStatus) => void }) { const beta = useWorkspace().mode === "beta"; return <Modal onClose={onClose} className="booking-details-dialog"><div><div className="flex items-start justify-between pr-9"><div><p className="text-[9px] font-bold tracking-[.14em] text-[#758078]">DETALHES DA RESERVA</p><h2 className="mt-1 text-2xl font-bold tracking-[-.05em]">{booking.guestName}</h2><p className="mt-2 text-xs text-[#69736d]">{cabin?.name} · {booking.people} pessoas</p></div></div><div className="mt-5 grid grid-cols-2 gap-3"><Info icon={<LogIn size={16} />} label="Entrada" value={`${shortDate(booking.start)} · ${booking.checkIn}`} /><Info icon={<LogOut size={16} />} label="Saída" value={`${shortDate(booking.end)} · ${booking.checkOut}`} /></div><div className="mt-4 rounded-xl border border-[#e4e3dc] bg-white p-3"><div className="text-[10px] font-bold text-[#758078]">Controle de estadia</div><div className="mt-1.5"><GlassSelectMenu ariaLabel="Controle de estadia" value={booking.status} options={["Reservado", "Check-in realizado", "Finalizada"].map((status) => ({ value: status, label: status }))} onChange={(status) => onStatus(booking, status as BookingStatus)} inlineMenu /></div></div><div className="mt-4 grid grid-cols-2 gap-2"><Badge icon={<Users size={14} />} label={`${booking.people} hóspedes`} /><Badge icon={<Dog size={14} />} label={booking.pets ? "Pets autorizados" : "Sem pets"} /><Badge icon={<Coffee size={14} />} label={booking.breakfast ? "Café incluso" : "Sem café"} /><Badge icon={<PartyPopper size={14} />} label={booking.decoration ? "Com decoração" : "Sem decoração"} /></div><div className="mt-4 rounded-xl bg-[#fbf9f4] p-3"><p className="text-[9px] font-bold tracking-[.12em] text-[#758078]">RESTRIÇÕES E OBSERVAÇÕES</p><p className="mt-2 text-xs leading-5 text-[#536158]">{booking.intolerance ? `Café: ${booking.intolerance}. ` : "Sem intolerâncias informadas. "}{booking.notes || "Sem observações adicionais."}</p></div><div className="mt-4"><p className="text-[9px] font-bold tracking-[.12em] text-[#758078]">DOCUMENTOS ANEXADOS</p>{booking.documents.length ? <div className="mt-2 grid gap-2">{booking.documents.map((document) => <div key={document.id} className="flex items-center justify-between rounded-xl border border-[#e4e3dc] bg-white p-3"><span className="flex min-w-0 items-center gap-2"><FileText size={16} className="shrink-0 text-[#1f4b3a]" /><span className="min-w-0"><b className="block truncate text-[11px]">{document.name}</b><small className="text-[9px] text-[#758078]">{document.type} · {formatSize(document.size)}</small></span></span>{document.pathname ? <a aria-label={beta ? `Baixar ${document.name}` : undefined} href={`/api/documents/download?pathname=${encodeURIComponent(document.pathname)}&name=${encodeURIComponent(document.name)}&mode=${document.pathname.startsWith("beta/") ? "beta" : "production"}`} className="grid h-8 w-8 place-items-center rounded-lg bg-[#edf3ee] text-[#1f4b3a]"><Download size={14} /></a> : document.data ? <a aria-label={beta ? `Baixar ${document.name}` : undefined} href={document.data} download={document.name} className="grid h-8 w-8 place-items-center rounded-lg bg-[#edf3ee] text-[#1f4b3a]"><Download size={14} /></a> : <Paperclip size={14} className="text-[#758078]" />}</div>)}</div> : <p className="mt-2 rounded-xl border border-dashed border-[#d2d8d1] p-3 text-[10px] text-[#758078]">Nenhum documento anexado. Use Editar para anexar nesta reserva.</p>}</div><div className="mt-5 flex gap-2"><button onClick={onEdit} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1f4b3a] text-xs font-bold text-white"><Pencil size={14} /> Editar reserva</button><button onClick={onDelete} className="grid h-10 w-10 place-items-center rounded-xl border border-[#f0d6cf] bg-[#fff7f5] text-[#a65746]" aria-label="Excluir reserva"><Trash2 size={15} /></button></div></div></Modal>; }
function CabinModal({ cabins, newName, onName, onAdd, onRename, onClose }: { cabins: Cabin[]; newName: string; onName: (name: string) => void; onAdd: () => void; onRename: (id: string, name: string) => void; onClose: () => void }) { return <Modal onClose={onClose}><div><p className="text-[9px] font-bold tracking-[.14em] text-[#758078]">UNIDADES</p><h2 className="mt-1 text-2xl font-bold tracking-[-.05em]">Gerenciar chalés</h2><p className="mt-2 text-xs leading-5 text-[#69736d]">Você pode renomear os dois chalés existentes ou adicionar novas unidades.</p><div className="mt-5 grid gap-2">{cabins.map((cabin) => <label key={cabin.id} className="flex items-center gap-3 rounded-xl border border-[#e4e3dc] bg-white p-3"><i className={`h-3 w-3 rounded-full ${dotClass(cabin.tone)}`} /><input defaultValue={cabin.name} onBlur={(event) => onRename(cabin.id, event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs font-bold outline-none" /><Pencil size={14} className="text-[#758078]" /></label>)}</div><div className="mt-4 flex gap-2"><input value={newName} onChange={(event) => onName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onAdd(); }} placeholder="Nome do novo chalé" className="h-10 min-w-0 flex-1 rounded-xl border border-[#dcded8] px-3 text-xs outline-[#75a385]" /><button onClick={onAdd} className="grid h-10 w-10 place-items-center rounded-xl bg-[#1f4b3a] text-white" aria-label="Adicionar chalé"><Plus size={16} /></button></div></div></Modal>; }
function Modal({ children, onClose, className = "" }: { children: React.ReactNode; onClose: () => void; className?: string }) { const { mode } = useWorkspace(); useEffect(() => { const root = document.documentElement; const body = document.body; const previousRootOverflow = root.style.overflow; const previousBodyOverflow = body.style.overflow; root.style.overflow = "hidden"; body.style.overflow = "hidden"; return () => { root.style.overflow = previousRootOverflow; body.style.overflow = previousBodyOverflow; }; }, []); if (mode === "beta") return <BetaDialog onClose={onClose} className={className}>{children}</BetaDialog>; return <div className="fixed inset-0 z-40 grid overscroll-contain place-items-center bg-[#18272065] p-4 backdrop-blur-sm"><section className={`relative max-h-[92vh] w-full max-w-[560px] overscroll-contain overflow-y-auto rounded-[22px] bg-[#fffefa] p-6 shadow-2xl ${className}`}><button type="button" onClick={onClose} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg border border-[#e4e3dc] bg-white" aria-label="Fechar"><X size={17} /></button>{children}</section></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-[10px] font-bold text-[#5e6962]">{label}<span className="[&_input]:h-10 [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-[#dcded8] [&_input]:bg-white [&_input]:px-3 [&_input]:text-xs [&_input]:outline-[#75a385] [&_select]:h-10 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-[#dcded8] [&_select]:bg-white [&_select]:px-3 [&_select]:text-xs [&_textarea]:min-h-20 [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-[#dcded8] [&_textarea]:bg-white [&_textarea]:p-3 [&_textarea]:text-xs [&_textarea]:outline-[#75a385]">{children}</span></label>; }
function Switch({ label, icon, checked, onChange }: { label: string; icon: React.ReactNode; checked: boolean; onChange: (value: boolean) => void }) { const id = useId(); const labelId = `${id}-label`; return <div className={`booking-option-switch ${checked ? "is-on" : ""}`}><label id={labelId} htmlFor={id} data-slot="label" className="booking-option-label">{icon}{label}</label><GlassCNGlassSwitch size="sm" id={id} aria-labelledby={labelId} className="booking-option-control" ariaLabel={label} checked={checked} onCheckedChange={onChange} /></div>; }
function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <div className="min-h-[84px] rounded-xl border border-[#e4e3dc] bg-white p-3 md:min-h-[104px] md:p-4"><span className="block text-[9px] font-bold text-[#778078]">{label}</span><strong className="mt-2 block text-[17px] font-bold tracking-[-.05em] text-[#1f4b3a] md:text-[21px]">{value}</strong><em className="mt-1 block text-[9px] not-italic text-[#8a928b]">{note}</em></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><span className="block text-[9px] font-bold text-[#778078]">{label}</span><b className="mt-1 block text-[11px]">{value}</b></div>; }
function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="rounded-xl bg-[#f2f6f3] p-3"><span className="text-[#1f4b3a]">{icon}</span><p className="mt-2 text-[9px] font-bold text-[#758078]">{label}</p><b className="mt-1 block text-xs">{value}</b></div>; }
function Badge({ icon, label }: { icon: React.ReactNode; label: string }) { return <div className="flex items-center gap-2 rounded-lg bg-[#f7f7f3] px-2.5 py-2 text-[10px] font-bold text-[#536158]">{icon}{label}</div>; }
