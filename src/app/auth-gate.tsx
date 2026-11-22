"use client";
import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Camera, CheckCircle2, Download, ShieldCheck, X } from "lucide-react";
import SettingsPanel, { applyTheme, effectiveTheme, type SettingsUser } from "./settings-panel";
import { Glass, GlassSurface } from "@/components/ui/glass";
import { WorkspaceContext } from "./workspace-context";

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
    applyTheme(effectiveTheme(user));
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => { if (effectiveTheme(user) === "system") applyTheme("system"); };
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
  useEffect(() => {
    const openSettings = () => { setSettingsOpen(true); setManaging(false); };
    const openAccounts = () => {
      if (!user || user.role !== "admin" || user.preferences.betaEnabled) return;
      setManaging(true);
      setSettingsOpen(false);
    };
    const requestLogout = () => { void logout(); };
    window.addEventListener("open-settings-panel", openSettings);
    window.addEventListener("open-accounts-panel", openAccounts);
    window.addEventListener("request-auth-logout", requestLogout);
    return () => {
      window.removeEventListener("open-settings-panel", openSettings);
      window.removeEventListener("open-accounts-panel", openAccounts);
      window.removeEventListener("request-auth-logout", requestLogout);
    };
  }, [user]);
  if (loading) return <main className="grid min-h-screen place-items-center text-[#1f4b3a]" role="status" aria-label="Verificando acesso"><><svg aria-hidden="true" viewBox="0 0 24 24" className="size-7 animate-[spin_.9s_steps(8)_infinite] motion-reduce:animate-[spin_2.4s_steps(8)_infinite]"><>{Array.from({ length: 8 }, (_, i) => <line key={i} x1="12" y1="3" x2="12" y2="7.5" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeOpacity={0.25 + (0.75 * (i + 1)) / 8} transform={`rotate(${i * 45} 12 12)`} />)}</></svg><span className="sr-only">Verificando acesso…</span></></main>;
  if (!user) return <AccessForm initialError={error} firstAdmin={firstAdmin} onLogin={setUser} />;
  return <div className={user.preferences.betaEnabled ? "beta-design" : undefined}><header className="matto-admin-bar">
    <div id="matto-dashboard-brand" className="matto-dashboard-brand-slot"><Glass strength={0.28} blur={7} tint={0.14} dome={0.1} radius={999} className="matto-user-pill" contentClassName="relative z-10 flex items-center gap-2.5 px-3 py-1.5 text-sm font-semibold text-[#26372e] dark:text-white"><span className="matto-user-avatar grid size-8 shrink-0 place-items-center overflow-hidden rounded-full border border-[#1f4b3a]/20 bg-[#1f4b3a]/10 text-[#1f4b3a] shadow-inner dark:border-white/20 dark:bg-white/10 dark:text-white">{user.avatarUrl ? <Image src={user.avatarUrl} alt="" width={32} height={32} unoptimized className="size-full object-cover" /> : <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="3.4" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" strokeLinecap="round" /></svg>}</span><span className="max-w-44 truncate">{user.name}</span></Glass></div>
    <div id="matto-dashboard-tabs" className="matto-dashboard-tabs-slot" />

    <div id="matto-dashboard-actions" className="matto-dashboard-actions-slot" data-can-manage-accounts={user.role === "admin" && !user.preferences.betaEnabled ? "true" : "false"} />
  </header>{error && <p role="alert" className="bg-[#fff7f5] p-3 text-center text-[#a65746]">{error}</p>}{managing && !user.preferences.betaEnabled && <Accounts onClose={() => setManaging(false)} />}{settingsOpen && <SettingsPanel user={user} onUser={setUser} onBack={() => setSettingsOpen(false)} accounts={<Accounts onClose={() => setSettingsOpen(false)} />} onCabins={() => { setSettingsOpen(false); window.dispatchEvent(new Event("open-cabin-settings")); }} />}{user.role === "admin" && !user.preferences.betaEnabled && <BackupNotifier />}{user.preferences.betaEnabled && <div role="status" className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5d1af] bg-[#f3e9da] px-5 py-3 text-sm text-[#906a36]"><span><b>MODO BETA</b> · Ambiente de testes pessoal. Dados e anexos reais protegidos.</span><button onClick={() => setSettingsOpen(true)} className="min-h-11 rounded-lg border border-current px-3 font-semibold">Gerenciar Modo Beta</button></div>}<WorkspaceContext.Provider value={{ mode: user.preferences.betaEnabled ? "beta" : "production", documentPrefix: user.preferences.betaEnabled ? `beta/${user.id}/reservas/` : "reservas/" }}><div key={user.preferences.betaEnabled ? "beta" : "production"} hidden={settingsOpen}>{children}</div></WorkspaceContext.Provider></div>;
}
function AccessForm({ initialError, firstAdmin, onLogin }: { initialError: string; firstAdmin: boolean; onLogin: (user: User) => void }) {
  const [register, setRegister] = useState(firstAdmin);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialError);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarPreviewRef = useRef<string | null>(null);
  useEffect(() => () => { if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current); }, []);
  function selectAvatar(file: File | null) {
    if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current);
    const preview = file ? URL.createObjectURL(file) : null;
    avatarPreviewRef.current = preview;
    setAvatarPreview(preview);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (register && form.get("password") !== form.get("confirmation")) { setMessage("As senhas não coincidem."); return; }
    setBusy(true); setMessage("");
    try {
      const data = register
        ? await api("/api/auth/register", { method: "POST", body: form })
        : await api("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
      if (data.user) onLogin(data.user);
      else { setRegister(false); setMessage(data.message); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro de conexão."); }
    finally { setBusy(false); }
  }
  const field = "auth-01-field mt-2 h-12 w-full rounded-xl border px-3 text-sm outline-none transition focus:ring-2 focus:ring-[#69aaff]/30";
  return <main className="auth-01-page relative isolate grid min-h-screen place-items-center overflow-hidden px-4 py-10 text-[#e9f1ec]">
    <div aria-hidden="true" className="auth-01-aurora auth-01-aurora-one" />
    <div aria-hidden="true" className="auth-01-aurora auth-01-aurora-two" />
    <GlassSurface tint={0.2} tintColor="25,42,66" blur={24} saturation={1.5} radius={24} specular className="relative z-10 w-full max-w-[30rem] overflow-hidden border border-white/15 shadow-[0_24px_80px_rgba(0,0,0,.42)]" contentClassName="p-6 sm:p-8">
      <header className="mb-7 text-center">
        <h1 className="text-2xl font-semibold tracking-[-.04em]">{register ? firstAdmin ? "Criar administrador" : "Criar conta" : "Bem-vindo de volta"}</h1>
        <p className="mt-2 text-sm leading-5 text-white/65">{register ? firstAdmin ? "Configure o primeiro acesso administrativo." : "Solicite acesso ao painel de gestão." : "Entre para continuar de onde você parou."}</p>
      </header>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {register && <>
          <div className="grid gap-1"><label htmlFor="auth-display-name" className="text-xs font-medium text-white/75">Nome de exibição</label><input id="auth-display-name" className={field} name="name" autoComplete="name" required minLength={2} maxLength={100} placeholder="Como devemos chamar você?" /></div>
          <div className="flex items-center gap-3">
            <label htmlFor="auth-avatar" className="group relative grid size-16 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border border-white/25 bg-white/10 text-white/75 transition hover:border-[#9dcaff]/75 hover:bg-white/15">
              {avatarPreview ? <Image src={avatarPreview} alt="Prévia da foto de perfil" width={64} height={64} unoptimized className="size-full object-cover" /> : <Camera size={22} />}
              <input id="auth-avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/avif,image/bmp,.jfif,.jpe,.jpg,.jpeg,.png,.gif,.webp,.avif,.bmp" className="sr-only" onChange={event => { const file = event.currentTarget.files?.[0] ?? null; if (file && file.size > 4 * 1024 * 1024) { selectAvatar(null); setMessage("A foto deve ter até 4 MB."); event.currentTarget.value = ""; return; } setMessage(""); selectAvatar(file); }} />
            </label>
            <div className="min-w-0"><p className="text-sm font-semibold text-white/90">Foto de perfil <span className="font-normal text-white/50">(opcional)</span></p><p className="mt-1 text-[10px] leading-4 text-white/55">GIF, JPEG/JFIF, PNG, WebP, AVIF ou BMP · até 4 MB</p><p className="text-[10px] leading-4 text-white/40">GIFs animados são preservados.</p></div>
          </div>
        </>}
        <div className="grid gap-1"><label htmlFor="auth-username" className="text-sm font-semibold text-white/90">Usuário</label><input id="auth-username" className={field} name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} minLength={3} maxLength={50} placeholder="Ex.: kawan" required /><span className="text-[10px] leading-4 text-white/45">3 a 50 caracteres; não diferencia maiúsculas e minúsculas.</span></div>
        <div className="grid gap-1"><div className="flex items-center justify-between"><label htmlFor="auth-password" className="text-sm font-semibold text-white/90">Senha</label></div><div className="relative"><input id="auth-password" className={`${field} pr-20`} name="password" type={show ? "text" : "password"} minLength={4} maxLength={register ? 8 : 128} autoComplete={register ? "new-password" : "current-password"} required placeholder="Digite sua senha" /><button type="button" className="absolute right-1 top-1/2 inline-flex h-9 -translate-y-1/2 items-center justify-center rounded-lg px-2 text-xs font-semibold text-white/65 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a9d2ff]/70" aria-label={show ? "Ocultar senha" : "Mostrar senha"} aria-pressed={show} onClick={() => setShow(!show)}>{show ? "Ocultar" : "Mostrar"}</button></div><span className="text-[10px] leading-4 text-white/45">{register ? "De 4 a 8 caracteres." : "Senhas antigas mais longas continuam válidas."}</span></div>
        {register && <div className="grid gap-1"><label htmlFor="auth-confirm-password" className="text-xs font-medium text-white/75">Confirmar senha</label><input id="auth-confirm-password" className={field} name="confirmation" type="password" autoComplete="new-password" required minLength={4} maxLength={8} placeholder="Digite a senha novamente" /></div>}
        {message && <p className="rounded-xl border border-white/15 bg-white/[.06] p-3 text-xs leading-5 text-white/85" role="status" aria-live="polite">{message}</p>}
        <button disabled={busy} className="mt-1 inline-flex min-h-12 items-center justify-center rounded-full border border-[#84bdff]/45 bg-[#4a9fff] px-4 text-sm font-semibold text-[#071426] shadow-[inset_0_1px_0_rgba(255,255,255,.4),0_8px_22px_rgba(31,113,214,.25)] transition hover:bg-[#69b0ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a9d2ff]/70 disabled:cursor-wait disabled:opacity-60">{busy ? "Aguarde…" : register ? firstAdmin ? "Criar administrador" : "Solicitar acesso" : "Entrar"}</button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-white/55"><span className="h-px flex-1 bg-white/15" /><span>ou</span><span className="h-px flex-1 bg-white/15" /></div>
      <button disabled={busy} onClick={() => { setRegister(!register); setMessage(""); }} className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-white/10 bg-[#263b5c]/85 px-4 text-sm font-semibold text-white transition hover:bg-[#31496f] disabled:opacity-50">{register ? "Já tem uma conta? Entrar" : "Criar uma conta"}</button>
      <footer className="-mx-6 -mb-6 mt-6 border-t border-white/10 bg-[#203555]/45 px-6 py-4 text-center sm:-mx-8 sm:-mb-8 sm:px-8"><p className="flex items-center justify-center gap-2 text-[11px] text-white/65"><ShieldCheck size={14} /> Acesso restrito a contas aprovadas</p></footer>
    </GlassSurface>
  </main>;
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

function BackupNotifier() {
  const [backup, setBackup] = useState<{ id: string; filename: string; size: number; createdAt: string } | null>(null);
  const [dismissed, setDismissed] = useState("");
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const response = await fetch("/api/backups", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (active && data.pending?.id !== dismissed) setBackup(data.pending ?? null);
      } catch { /* The reminder will retry on the next poll. */ }
    };
    const initial = window.setTimeout(() => { void check(); }, 0);
    const interval = window.setInterval(() => { void check(); }, 20000);
    return () => { active = false; window.clearTimeout(initial); window.clearInterval(interval); };
  }, [dismissed]);
  async function acknowledge(id: string) {
    setBackup(null); setDismissed(id);
    try { await fetch("/api/backups", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "acknowledge", id }) }); } catch { /* Keep this notice dismissed for the current session. */ }
  }
  if (!backup || backup.id === dismissed) return null;
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-[#101a14]/60 p-4 backdrop-blur-sm" role="presentation"><section role="alertdialog" aria-modal="true" aria-labelledby="backup-notice-title" className="relative w-full max-w-md rounded-2xl bg-white p-6 text-[#22322b] shadow-2xl"><button type="button" aria-label="Fechar aviso" onClick={() => void acknowledge(backup.id)} className="absolute right-4 top-4 grid size-10 place-items-center rounded-full text-[#536158] hover:bg-[#f2f6f3]"><X size={18} /></button><span className="grid size-12 place-items-center rounded-full bg-[#e7f3e9] text-[#1f7046]"><CheckCircle2 size={25} /></span><h2 id="backup-notice-title" className="mt-4 text-xl font-bold">Backup realizado</h2><p className="mt-2 text-sm leading-6 text-[#536158]">O seu backup de reserva foi realizado. Clique abaixo para salvá-lo em seu computador.</p><p className="mt-2 text-xs text-[#667269]">{new Date(backup.createdAt).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" })} · {(backup.size / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} KB</p><a href={`/api/backups/${backup.id}`} onClick={() => void acknowledge(backup.id)} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1f4b3a] px-4 text-sm font-semibold text-white"><Download size={17} /> Baixar backup</a></section></div>;
}
