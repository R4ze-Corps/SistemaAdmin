"use client";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { ArrowLeft, Check, Database, House, Info, KeyRound, Monitor, Moon, Palette, Save, ShieldCheck, Sun, UserRound, Users } from "lucide-react";

export type SettingsUser = { id: string; name: string; username: string; role: "admin" | "member"; status: "pending" | "approved" | "blocked"; preferences: { theme: "light" | "dark" | "system" } };
export function applyTheme(theme: SettingsUser["preferences"]["theme"]) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  // Cache only: the authoritative preference is saved with the account in MongoDB.
  if (theme === "system") localStorage.removeItem("refugio-theme"); else localStorage.setItem("refugio-theme", theme);
  window.dispatchEvent(new Event("theme-changed"));
}
const input = "mt-2 min-h-12 w-full rounded-xl border border-[#b7ccbc] bg-white px-3 text-base text-[#22322b] outline-[#75a385] disabled:opacity-60";
const saveButton = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1f4b3a] px-5 text-sm font-semibold text-white disabled:opacity-50";
type Tab = "profile" | "security" | "appearance" | "administration" | "about";
export default function SettingsPanel({ user, onUser, onBack, accounts, onCabins }: { user: SettingsUser; onUser: (user: SettingsUser) => void; onBack: () => void; accounts: ReactNode; onCabins: () => void }) {
  const [tab, setTab] = useState<Tab>("profile");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [sessions, setSessions] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/account", { cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      if (active) setSessions(data.activeSessions);
    }).catch(error => { if (active) { setFailed(true); setMessage(error.message); } });
    return () => { active = false; };
  }, []);
  async function update(body: Record<string, unknown>) {
    setBusy(true); setMessage(""); setFailed(false);
    try {
      const response = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (response.status === 401) window.dispatchEvent(new Event("auth-expired"));
      if (!response.ok) throw new Error(data.message);
      onUser(data.user);
      if (body.action === "preferences") applyTheme(data.user.preferences.theme);
      if (["sessions", "password"].includes(String(body.action))) setSessions(1);
      setMessage(data.message);
      return true;
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "Não foi possível salvar."); return false; }
    finally { setBusy(false); }
  }
  async function profile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (await update({ action: "profile", name, username, currentPassword: new FormData(form).get("currentPassword") })) form.reset();
  }
  async function password(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (data.get("password") !== data.get("confirmation")) { setFailed(true); setMessage("As novas senhas não coincidem."); return; }
    if (await update({ action: "password", currentPassword: data.get("currentPassword"), password: data.get("password") })) form.reset();
  }
  const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: "profile", label: "Meu perfil", icon: <UserRound size={18} /> }, { id: "security", label: "Senha e segurança", icon: <KeyRound size={18} /> }, { id: "appearance", label: "Aparência", icon: <Palette size={18} /> },
    ...(user.role === "admin" ? [{ id: "administration" as const, label: "Administração", icon: <Users size={18} /> }] : []), { id: "about", label: "Sobre o sistema", icon: <Info size={18} /> },
  ];
  return <main className="min-h-[calc(100vh-64px)] bg-[#f4f3ed] px-4 py-6 text-[#22322b] sm:px-8"><div className="mx-auto max-w-6xl"><button onClick={onBack} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#1f4b3a]"><ArrowLeft size={18} /> Voltar ao painel</button><h1 className="text-3xl font-bold tracking-tight">Configurações</h1><p className="mt-2 text-sm leading-6 text-[#536158]">Sua conta, suas preferências e a administração do sistema em um só lugar.</p><div className="mt-7 grid gap-5 md:grid-cols-[240px_minmax(0,1fr)]"><nav aria-label="Categorias de configurações" className="flex gap-2 overflow-x-auto md:flex-col">{tabs.map(item => <button key={item.id} aria-current={tab === item.id ? "page" : undefined} disabled={busy} onClick={() => { setTab(item.id); setMessage(""); }} className={`inline-flex min-h-12 shrink-0 items-center gap-3 rounded-xl px-4 text-left text-sm font-semibold ${tab === item.id ? "bg-[#1f4b3a] text-white" : "bg-white text-[#536158]"}`}>{item.icon}{item.label}</button>)}</nav><section className="min-w-0 rounded-2xl border border-[#e4e3dc] bg-white p-5 sm:p-7"><p role="status" aria-live="polite" className={message ? `mb-5 rounded-xl border p-3 text-sm leading-6 ${failed ? "border-[#f0d6cf] bg-[#fff7f5] text-[#a65746]" : "border-[#b7ccbc] bg-[#f0f7f2] text-[#1f4b3a]"}` : "sr-only"}>{message}</p>
    {tab === "profile" && <><SectionTitle title="Meu perfil" description="Atualize o nome que aparece no painel e o identificador usado para entrar." /><form onSubmit={profile} className="mt-6 grid max-w-xl gap-5"><label className="text-sm font-semibold">Nome de exibição<input className={input} value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={100} autoComplete="name" /></label><label className="text-sm font-semibold">Nome de login<input className={input} value={username} onChange={event => setUsername(event.target.value)} required minLength={3} maxLength={50} autoComplete="username" autoCapitalize="none" spellCheck={false} /><small className="mt-2 block font-normal text-[#536158]">O login é único e não diferencia maiúsculas de minúsculas.</small></label><label className="text-sm font-semibold">Senha atual para confirmar mudança de login<input name="currentPassword" type="password" className={input} maxLength={128} autoComplete="current-password" /></label><div className="flex items-center gap-2 rounded-xl bg-[#f2f6f3] p-3 text-sm"><ShieldCheck size={18} /> {user.role === "admin" ? "Administrador — controle total" : "Conta aprovada — acesso ao painel compartilhado"}</div><button disabled={busy} className={saveButton}><Save size={17} /> {busy ? "Salvando…" : "Salvar perfil"}</button></form></>}
    {tab === "security" && <><SectionTitle title="Senha e segurança" description="A alteração de senha encerra todas as sessões anteriores e mantém este acesso com uma nova sessão." /><form onSubmit={password} className="mt-6 grid max-w-xl gap-5"><label className="text-sm font-semibold">Senha atual<input type="password" name="currentPassword" autoComplete="current-password" required maxLength={128} className={input} /></label><label className="text-sm font-semibold">Nova senha<input type="password" name="password" autoComplete="new-password" required minLength={4} maxLength={8} className={input} /><small className="mt-2 block font-normal text-[#536158]">De 4 a 8 caracteres. Evite nomes, datas e sequências previsíveis.</small></label><label className="text-sm font-semibold">Confirmar nova senha<input type="password" name="confirmation" autoComplete="new-password" required minLength={4} maxLength={8} className={input} /></label><button disabled={busy} className={saveButton}><KeyRound size={17} /> Alterar senha</button></form><div className="mt-8 border-t border-[#e4e3dc] pt-6"><h3 className="font-semibold">Sessões de acesso</h3><p className="mt-2 text-sm text-[#536158]">{sessions === null ? "Consultando sessões…" : `${sessions} sessão(ões) ativa(s).`} Sessões expiram em até sete dias.</p><button disabled={busy || sessions === null} onClick={() => update({ action: "sessions" })} className="mt-4 min-h-11 rounded-xl border border-[#b7ccbc] px-4 text-sm font-semibold text-[#1f4b3a] disabled:opacity-50">Encerrar acessos em outros dispositivos</button></div></>}
    {tab === "appearance" && <><SectionTitle title="Aparência" description="Escolha o tema da sua conta. A preferência é salva no MongoDB e aplicada quando você entrar em outro dispositivo." /><div className="mt-6 grid gap-3 sm:grid-cols-3">{[{ id: "light", label: "Claro", icon: <Sun size={24} /> }, { id: "dark", label: "Escuro", icon: <Moon size={24} /> }, { id: "system", label: "Automático", icon: <Monitor size={24} /> }].map(theme => <button key={theme.id} disabled={busy} aria-pressed={user.preferences.theme === theme.id} onClick={() => update({ action: "preferences", theme: theme.id })} className={`flex min-h-32 flex-col items-start justify-between rounded-xl border p-4 text-sm font-semibold ${user.preferences.theme === theme.id ? "border-[#b7ccbc] bg-[#f0f7f2] text-[#1f4b3a]" : "border-[#e4e3dc]"}`}>{theme.icon}<span className="flex w-full items-center justify-between">{theme.label}{user.preferences.theme === theme.id && <Check size={18} />}</span></button>)}</div><p className="mt-4 text-sm leading-6 text-[#536158]">No modo automático, o painel acompanha a aparência do seu dispositivo.</p></>}
    {tab === "administration" && user.role === "admin" && <><SectionTitle title="Administração" description="Gerencie quem acessa o painel e mantenha as unidades de hospedagem organizadas." /><div className="mt-6 rounded-xl border border-[#e4e3dc] p-4"><div className="flex items-center gap-2 font-semibold"><House size={20} /> Chalés e unidades</div><p className="mt-2 text-sm text-[#536158]">Renomeie os chalés existentes ou adicione novas unidades à agenda.</p><button onClick={onCabins} className="mt-4 min-h-11 rounded-xl border border-[#b7ccbc] px-4 text-sm font-semibold text-[#1f4b3a]">Gerenciar chalés</button></div><div className="mt-5">{accounts}</div></>}
    {tab === "about" && <><SectionTitle title="Sobre o sistema" description="Sistema Administrativo — gestão de reservas e financeiro." /><div className="mt-6 grid gap-4 text-sm leading-6"><div className="rounded-xl bg-[#f2f6f3] p-4"><h3 className="flex items-center gap-2 font-semibold"><Database size={18} /> Dados no MongoDB</h3><p className="mt-2 text-[#536158]">Contas, preferências, reservas, chalés e financeiro são armazenados no banco. Os arquivos anexados ficam no Vercel Blob privado.</p></div><div className="rounded-xl border border-[#e4e3dc] p-4"><h3 className="font-semibold">Privacidade e acesso</h3><p className="mt-2 text-[#536158]">Todas as contas aprovadas compartilham os dados do painel. Senhas são protegidas por hash e não são exibidas nem armazenadas em texto simples. O tema local é apenas um cache da preferência da conta.</p></div><p className="text-[#536158]">Idioma: Português (Brasil) · Moeda: Real brasileiro (R$)</p></div></>}
    </section></div></div></main>;
}
function SectionTitle({ title, description }: { title: string; description: string }) { return <><h2 className="text-xl font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-[#536158]">{description}</p></>; }
