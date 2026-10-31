import { getDatabase } from "@/lib/mongodb";
import { runReservationBackup, type BackupProgress, type BackupSettingsRecord } from "@/lib/backup";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ message: "Não autorizado." }, { status: 401 });
  try {
    const db = await getDatabase();
    const settings = await db.collection<BackupSettingsRecord>("system_settings").findOne({ _id: "reservation-backup" });
    if (!settings || settings.cadence === "disabled" || !settings.nextBackupAt || new Date(settings.nextBackupAt).getTime() > Date.now()) return Response.json({ skipped: true, reason: "Backup ainda não está vencido." });
    const job = await db.collection<BackupProgress & { _id: string }>("backup_jobs").findOne({ _id: "current" });
    if (job?.running) return Response.json({ skipped: true, reason: "Já existe um backup em andamento." });
    const backup = await runReservationBackup("scheduled");
    return Response.json({ backup });
  } catch {
    return Response.json({ message: "Falha ao realizar o backup agendado." }, { status: 503 });
  }
}
