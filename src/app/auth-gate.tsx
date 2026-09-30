"use client";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Eye, EyeOff, LogOut, ShieldCheck, TreePalm, Users, X } from "lucide-react";

type User = { id: string; name: string; username: string; role: "admin" | "member"; status: "pending" | "approved" | "blocked" };
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
  useEffect(() => {
    let active = true;
    api("/api/auth/me").then(data => { if (active) setUser(data.user); }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    const expired = () => { setUser(null); setError("Sua sessão expirou. Entre novamente."); };
    window.addEventListener("auth-expired", expired);
    return () => { active = false; window.removeEventListener("auth-expired", expired); };
  }, []);
  async function logout() {
    try { await api("/api/auth/logout", { method: "POST" }); setUser(null); setManaging(false); }
    catch (error) { setError(error instanceof Error ? error.message : "Não foi possível sair."); }
  }
  if (loading) return <main className="grid min-h-screen place-items-center bg-[#f4f3ed] text-[#22322b]" role="status">Verificando acesso…</main>;
  if (!user) return <AccessForm initialError={error} onLogin={setUser} />;
  return <><div className="flex flex-wrap items-center justify-end gap-3 border-b border-[#e4e3dc] bg-white px-5 py-2 text-sm text-[#536158]"><span>{user.name}</span>{user.role === "admin" && <button className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 font-semibold text-[#1f4b3a]" onClick={() => setManaging(!managing)} aria-expanded={managing}><Users size={17} /> Contas</button>}<button className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3" onClick={logout}><LogOut size={17} /> Sair</button></div>{error && <p role="alert" className="bg-[#fff7f5] p-3 text-center text-[#a65746]">{error}</p>}{managing && <Accounts onClose={() => setManaging(false)} />}{children}</>;
}
function AccessForm({ initialError, onLogin }: { initialError: string; onLogin: (user: User) => void }) {
  const [register, setRegister] = useState(false);
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
  return <main className="grid min-h-screen place-items-center bg-[#f4f3ed] px-4 py-10 text-[#22322b]"><section className="w-full max-w-md rounded-3xl border border-[#e4e3dc] bg-white p-6 shadow-sm sm:p-8"><div className="mb-6 flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-xl bg-[#1f4b3a] text-white"><TreePalm size={24} /></span><div><p className="text-xs font-semibold tracking-wider text-[#536158]">SISTEMA ADMINISTRATIVO</p><h1 className="text-2xl font-bold">{register ? "Criar conta" : "Bem-vindo de volta"}</h1></div></div><p className="mb-6 text-sm leading-6 text-[#536158]">{register ? "Solicite acesso ao painel. Sua conta será liberada pelo administrador." : "Entre para gerenciar reservas, documentos e financeiro."}</p><form onSubmit={submit} className="grid gap-4">{register && <label className="text-sm font-semibold">Nome de exibição<input className={field} name="name" autoComplete="name" required minLength={2} maxLength={100} /></label>}<label className="text-sm font-semibold">Nome (login)<input className={field} name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} minLength={3} maxLength={50} placeholder="Ex.: kawan" required /><span className="mt-2 block text-xs font-normal text-[#536158]">3 a 50 caracteres. Não diferencia maiúsculas e minúsculas.</span></label><label className="text-sm font-semibold">Senha<div className="relative"><input className={`${field} pr-12`} name="password" type={show ? "text" : "password"} minLength={12} maxLength={128} autoComplete={register ? "new-password" : "current-password"} required /><button type="button" className="absolute bottom-0 right-0 grid h-12 w-12 place-items-center" aria-label={show ? "Ocultar senha" : "Mostrar senha"} aria-pressed={show} onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><span className="mt-2 block text-xs font-normal text-[#536158]">Mínimo de 12 caracteres.</span></label>{register && <><label className="text-sm font-semibold">Confirmar senha<input className={field} name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label><details className="text-sm text-[#536158]"><summary className="cursor-pointer py-2">Configurar conta administradora</summary><label className="block pt-2">Chave de configuração<input className={field} name="setupKey" type="password" autoComplete="off" maxLength={256} /></label><p className="mt-2 text-xs leading-5">Somente para o nome de login do administrador definido no servidor.</p></details></>}{message && <p className="rounded-xl border border-[#b7ccbc] p-3 text-sm leading-5" role="status" aria-live="polite">{message}</p>}<button disabled={busy} className="min-h-12 rounded-xl bg-[#1f4b3a] font-semibold text-white disabled:opacity-60">{busy ? "Aguarde…" : register ? "Solicitar cadastro" : "Entrar"}</button></form><button disabled={busy} onClick={() => { setRegister(!register); setMessage(""); }} className="mt-4 min-h-11 w-full text-sm font-semibold text-[#1f4b3a]">{register ? "Já tenho conta — entrar" : "Não tenho conta — criar conta"}</button><p className="mt-5 flex items-center justify-center gap-2 text-xs text-[#536158]"><ShieldCheck size={15} /> Acesso restrito a contas aprovadas</p></section></main>;
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
