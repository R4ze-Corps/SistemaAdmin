"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, HardDriveDownload, LoaderCircle, Play, RotateCcw, Upload } from "lucide-react";
import "./backup-settings.css";

type BackupStatus = { cadence: "disabled" | "3" | "15" | "30"; nextBackupAt: string | null; lastBackupAt: string | null; progress: { id: string; progress: number; stage: string; running: boolean } | null };
const cadenceOptions = [{ value: "disabled", label: "Desativado" }, { value: "3", label: "A cada 3 dias" }, { value: "15", label: "A cada 15 dias" }, { value: "30", label: "A cada 30 dias" }] as const;

export default function BackupSettings() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const refresh = useCallback(async () => {
    const response = await fetch("/api/backups", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Não foi possível consultar os backups.");
    setStatus(data);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void refresh().catch(reason => setError(reason.message)); }, 0); return () => window.clearTimeout(timer); }, [refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => { void refresh().catch(() => undefined); }, busy ? 700 : 15000);
    return () => window.clearInterval(timer);
  }, [busy, refresh]);
  async function changeSchedule(cadence: BackupStatus["cadence"]) {
    setError(""); setMessage("");
    try {
      const response = await fetch("/api/backups", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "schedule", cadence }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Não foi possível salvar o agendamento.");
      setMessage(data.message); await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Erro de conexão."); }
  }
  async function runNow() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/backups", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Não foi possível gerar o backup.");
      setMessage(data.message); await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Erro de conexão."); }
    finally { setBusy(false); }
  }
  async function restoreBackup() {
    if (!backupFile) { setError("Selecione um arquivo de backup .json.gz."); return; }
    const confirmed = window.confirm("Restaurar este backup substituirá as reservas, chalés, dados financeiros e o cardápio atuais pelos dados do arquivo. Esta ação não pode ser desfeita. Continuar?");
    if (!confirmed) return;
    setRestoring(true); setError(""); setMessage("");
    try {
      const form = new FormData(); form.set("backup", backupFile);
      const response = await fetch("/api/backups/restore", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Não foi possível restaurar o backup.");
      const counts = data.counts;
      setMessage(`Dados restaurados: ${counts.bookings} reservas, ${counts.cabins} chalés, ${counts.financeEntries} lançamentos, ${counts.payables} contas e ${counts.menuItems} itens do cardápio.`);
      setBackupFile(null);
      await refresh();
      window.dispatchEvent(new Event("backup-restored"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Erro ao restaurar o backup."); }
    finally { setRestoring(false); }
  }
  const progress = status?.progress;
  const date = (value: string | null) => value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" }) : "Ainda não realizado";
  return <div className="backup-settings mt-6 space-y-5">
    <section className="backup-card rounded-2xl border border-[#e4e3dc] p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#f0f7f2] text-[#1f4b3a]"><HardDriveDownload size={21} /></span><div><h3 className="font-semibold">Backup das reservas</h3><p className="mt-1 text-sm leading-6 text-[#536158]">Agende uma cópia dos dados operacionais e baixe o arquivo quando quiser.</p></div></div>
      <label className="mt-5 block max-w-md text-sm font-semibold">Frequência do backup<select className="backup-select mt-2 min-h-12 w-full rounded-xl border border-[#b7ccbc] bg-white px-3 text-base text-[#22322b]" value={status?.cadence ?? "disabled"} disabled={!status} onChange={event => void changeSchedule(event.target.value as BackupStatus["cadence"])}>{cadenceOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="backup-summary-card rounded-xl bg-[#f6f7f3] p-4"><p className="backup-summary-label flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#536158]"><Clock3 size={15} /> Próximo backup</p><p className="backup-summary-value mt-2 text-sm font-semibold">{status?.cadence === "disabled" ? "Agendamento desativado" : date(status?.nextBackupAt ?? null)}</p></div><div className="backup-summary-card rounded-xl bg-[#f6f7f3] p-4"><p className="backup-summary-label flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#536158]"><CheckCircle2 size={15} /> Último backup</p><p className="backup-summary-value mt-2 text-sm font-semibold">{date(status?.lastBackupAt ?? null)}</p></div></div>
      <button type="button" onClick={() => void runNow()} disabled={busy || restoring || Boolean(progress?.running)} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#1f4b3a] px-5 text-sm font-semibold text-white disabled:opacity-55">{busy ? <LoaderCircle className="animate-spin" size={17} /> : <Play size={17} />}{busy ? "Gerando backup…" : "Fazer backup agora"}</button>
      {busy && <div className="backup-progress-card mt-5 rounded-xl border border-[#e4e3dc] p-4" role="status" aria-live="polite"><div className="flex justify-between gap-3 text-sm"><span>{progress?.stage || "Iniciando backup…"}</span><b>{progress?.progress ?? 2}%</b></div><div className="backup-progress-track mt-3 h-2 overflow-hidden rounded-full bg-[#e7e9e4]"><div className="h-full rounded-full bg-[#2d7457] transition-[width] duration-500" style={{ width: `${progress?.progress ?? 2}%` }} /></div></div>}
      <p className="backup-note mt-4 text-xs leading-5 text-[#667269]">Inclui chalés, reservas, financeiro, contas a pagar e dados do cardápio. Os arquivos anexados às reservas e as imagens do cardápio ficam em armazenamento separado e não são incluídos neste arquivo.</p>
      <section className="backup-restore-card mt-6 rounded-xl border border-[#e4e3dc] p-4 sm:p-5"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#f0f7f2] text-[#1f4b3a]"><RotateCcw size={19} /></span><div><h3 className="font-semibold">Restaurar dados</h3><p className="mt-1 text-sm leading-6 text-[#536158]">Anexe um backup `.json.gz` baixado deste sistema. A restauração substitui os dados atuais incluídos no arquivo.</p></div></div><label className="mt-4 block text-sm font-semibold">Arquivo de backup<input type="file" accept=".gz,.json.gz,application/gzip" disabled={restoring} onChange={event => setBackupFile(event.target.files?.[0] ?? null)} className="mt-2 block min-h-12 w-full cursor-pointer rounded-xl border border-[#b7ccbc] bg-white text-sm file:mr-3 file:min-h-12 file:border-0 file:bg-[#f0f7f2] file:px-4 file:font-semibold file:text-[#1f4b3a]" />{backupFile && <span className="mt-2 block text-xs font-normal text-[#536158]">Selecionado: {backupFile.name} · {(backupFile.size / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} KB</span>}</label><p className="backup-warning mt-3 text-xs leading-5 text-[#8b5d28]">Esta ação substitui as reservas, chalés, lançamentos financeiros, contas a pagar e cardápio existentes. Anexos e imagens não fazem parte do backup. Faça um backup atual antes de restaurar.</p><button type="button" disabled={restoring || !backupFile} onClick={() => void restoreBackup()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#b7ccbc] px-4 text-sm font-semibold text-[#1f4b3a] disabled:cursor-not-allowed disabled:opacity-50">{restoring ? <LoaderCircle className="animate-spin" size={16} /> : <Upload size={16} />}{restoring ? "Validando e restaurando…" : "Restaurar dados"}</button></section>
      {(message || error) && <p role={error ? "alert" : "status"} className={`mt-4 flex items-center gap-2 text-sm ${error ? "text-[#a65746]" : "text-[#1f4b3a]"}`}>{error && <AlertCircle size={16} />}{error || message}</p>}
    </section>
  </div>;
}
