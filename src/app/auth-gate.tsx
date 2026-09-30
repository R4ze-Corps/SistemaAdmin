"use client";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Eye, EyeOff, LogOut, Settings, ShieldCheck, TreePalm, Users, X } from "lucide-react";
import SettingsPanel, { applyTheme, type SettingsUser } from "./settings-panel";

type User = SettingsUser;
async function api(path: string, options?: RequestInit) {
  const response = await fetch(path, { ...options, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Não foi possível concluir a solicitação.");
  return data;
}
export default function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [managing, setManaging] = useState(false);
  const [firstAdmin, setFirstAdmin] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    if (!user) return;
    applyTheme(user.preferences.theme);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => { if (user.preferences.theme === "system") applyTheme("system"); };
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [user]);
  useEffect(() => {
    let active = true;
    Promise.all([api("/api/auth/me"), api("/api/auth/setup")]).then(([data, setup]) => { if (active) { setUser(data.user); setFirstAdmin(setup.needsAdministrator); } }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    const expired = () => { setUser(null); setSettingsOpen(false); setManaging(false); setError("Sua sessão expirou. Entre novamente."); };
    const updated = (event: Event) => setUser((event as CustomEvent<User>).detail);
    window.addEventListener("auth-expired", expired);
    window.addEventListener("account-updated", updated);
    return () => { active = false; window.removeEventListener("auth-expired", expired); window.removeEventListener("account-updated", updated); };
  }, []);
  async function logout() {
    try { await api("/api/auth/logout", { method: "POST" }); setUser(null); setManaging(false); setSettingsOpen(false); }
    catch (error) { setError(error instanceof Error ? error.message : "Não foi possível sair."); }
  }
  if (loading) return <main className="grid min-h-screen place-items-center bg-[#f4f3ed] text-[#22322b]" role="status">Verificando acesso…</main>;
  if (!user) return <AccessForm initialError={error} firstAdmin={firstAdmin} onLogin={setUser} />;
  return <><div className="flex flex-wrap items-center justify-end gap-3 border-b border-[#e4e3dc] bg-white px-5 py-2 text-sm text-[#536158]"><span>{user.name}</span><button onClick={() => { setSettingsOpen(!settingsOpen); setManaging(false); }} aria-expanded={settingsOpen} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 font-semibold text-[#1f4b3a]"><Settings size={18} /> Configurações</button>{user.role === "admin" && <button className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 font-semibold text-[#1f4b3a]" onClick={() => { setManaging(!managing); setSettingsOpen(false); }} aria-expanded={managing}><Users size={17} /> Contas</button>}<button className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3" onClick={logout}><LogOut size={17} /> Sair</button></div>{error && <p role="alert" className="bg-[#fff7f5] p-3 text-center text-[#a65746]">{error}</p>}{managing && <Accounts onClose={() => setManaging(false)} />}{settingsOpen && <SettingsPanel user={user} onUser={setUser} onBack={() => setSettingsOpen(false)} accounts={<Accounts onClose={() => setSettingsOpen(false)} />} onCabins={() => { setSettingsOpen(false); window.dispatchEvent(new Event("open-cabin-settings")); }} />}<div hidden={settingsOpen}>{children}</div></>;
}
function AccessForm({ initialError, firstAdmin, onLogin }: { initialError: string; firstAdmin: boolean; onLogin: (user: User) => void }) {
  const [register, setRegister] = useState(firstAdmin);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialError);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (register && form.get("password") !== form.get("confirmation")) { setMessage("As senhas não coincidem."); return; }
    setBusy(true); setMessage("");
    try {
      const data = await api(`/api/auth/${register ? "register" : "login"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
      if (data.user) onLogin(data.user);
      else { setRegister(false); setMessage(data.message); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro de conexão."); }
    finally { setBusy(false); }
  }
  const field = "mt-2 h-12 w-full rounded-xl border border-[#b7ccbc] bg-white px-3 text-base text-[#22322b] outline-[#1f4b3a]";
  return <main className="grid min-h-screen place-items-center bg-[#f4f3ed] px-4 py-10 text-[#22322b]"><section className="w-full max-w-md rounded-3xl border border-[#e4e3dc] bg-white p-6 shadow-sm sm:p-8"><div className="mb-6 flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-xl bg-[#1f4b3a] text-white"><TreePalm size={24} /></span><div><p className="text-xs font-semibold tracking-wider text-[#536158]">SISTEMA ADMINISTRATIVO</p><h1 className="text-2xl font-bold">{register ? firstAdmin ? "Criar administrador" : "Criar conta" : "Bem-vindo de volta"}</h1></div></div><p className="mb-6 text-sm leading-6 text-[#536158]">{register ? firstAdmin ? "Cadastre o nome de login e a senha do administrador. O primeiro cadastro concluído terá controle total do painel." : "Solicite acesso ao painel. Sua conta será liberada pelo administrador." : "Entre para gerenciar reservas, documentos e financeiro."}</p><form onSubmit={submit} className="grid gap-4">{register && <label className="text-sm font-semibold">Nome de exibição<input className={field} name="name" autoComplete="name" required minLength={2} maxLength={100} /></label>}<label className="text-sm font-semibold">Nome (login)<input className={field} name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} minLength={3} maxLength={50} placeholder="Ex.: kawan" required /><span className="mt-2 block text-xs font-normal text-[#536158]">3 a 50 caracteres. Não diferencia maiúsculas e minúsculas.</span></label><label className="text-sm font-semibold">Senha<div className="relative"><input className={`${field} pr-12`} name="password" type={show ? "text" : "password"} minLength={4} maxLength={register ? 8 : 128} autoComplete={register ? "new-password" : "current-password"} required /><button type="button" className="absolute bottom-0 right-0 grid h-12 w-12 place-items-center" aria-label={show ? "Ocultar senha" : "Mostrar senha"} aria-pressed={show} onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><span className="mt-2 block text-xs font-normal text-[#536158]">{register ? "De 4 a 8 caracteres." : "Digite sua senha. Senhas antigas mais longas continuam válidas."}</span></label>{register && <><label className="text-sm font-semibold">Confirmar senha<input className={field} name="confirmation" type="password" autoComplete="new-password" required minLength={4} maxLength={8} /></label></>}{message && <p className="rounded-xl border border-[#b7ccbc] p-3 text-sm leading-5" role="status" aria-live="polite">{message}</p>}<button disabled={busy} className="min-h-12 rounded-xl bg-[#1f4b3a] font-semibold text-white disabled:opacity-60">{busy ? "Aguarde…" : register ? firstAdmin ? "Criar administrador" : "Solicitar cadastro" : "Entrar"}</button></form><button disabled={busy} onClick={() => { setRegister(!register); setMessage(""); }} className="mt-4 min-h-11 w-full text-sm font-semibold text-[#1f4b3a]">{register ? "Já tenho conta — entrar" : "Não tenho conta — criar conta"}</button><p className="mt-5 flex items-center justify-center gap-2 text-xs text-[#536158]"><ShieldCheck size={15} /> Acesso restrito a contas aprovadas</p></section></main>;
}
function Accounts({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [message, setMessage] = useState("Carregando contas…");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api("/api/users").then(data => { setUsers(data.users); setMessage(""); }).catch(error => setMessage(error.message)); }, []);
  async function update(user: User, status: "approved" | "blocked") {
    setBusy(true);
    try {
      await api("/api/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: user.id, status }) });
      setUsers(items => items.map(item => item.id === user.id ? { ...item, status } : item));
      setMessage(status === "approved" ? "Acesso aprovado." : "Acesso bloqueado e sessões encerradas.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro de conexão."); }
    finally { setBusy(false); }
  }
  return <section className="border-b border-[#e4e3dc] bg-white p-5 text-[#22322b] sm:px-8" aria-label="Gerenciamento de contas"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Contas e permissões</h2><button onClick={onClose} aria-label="Fechar gerenciamento de contas" className="grid h-11 w-11 place-items-center"><X size={18} /></button></div><p className="mt-2 text-sm text-[#536158]">Contas aprovadas podem consultar e alterar todas as reservas, documentos e informações financeiras.</p><p role="status" aria-live="polite" className="mt-3 text-sm">{message}</p><div className="mt-4 grid gap-3">{users.map(user => <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e4e3dc] p-3"><div className="min-w-0"><p className="font-semibold">{user.name}</p><p className="break-all text-sm text-[#536158]">{user.username}</p><p className="mt-1 text-xs">{user.role === "admin" ? "Administrador" : user.status === "pending" ? "Aguardando aprovação" : user.status === "approved" ? "Aprovado" : "Bloqueado"}</p></div>{user.role !== "admin" && <button disabled={busy} onClick={() => update(user, user.status === "approved" ? "blocked" : "approved")} className="min-h-11 rounded-lg border border-[#b7ccbc] px-4 text-sm font-semibold disabled:opacity-50">{user.status === "approved" ? "Bloquear acesso" : "Aprovar acesso"}</button>}</div>)}</div></section>;
}
