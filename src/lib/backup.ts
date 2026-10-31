import { gzipSync } from "node:zlib";
import { GridFSBucket, ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";

export type BackupCadence = "disabled" | "3" | "15" | "30";
export type BackupProgress = { id: string; progress: number; stage: string; running: boolean; updatedAt: Date };
export type BackupSettingsRecord = { _id: string; cadence?: BackupCadence; nextBackupAt?: Date | null; lastBackupAt?: Date | null; lastBackupId?: string; updatedAt?: Date; createdAt?: Date };
const settingsId = "reservation-backup";

export async function saveBackupCadence(cadence: BackupCadence) {
  const db = await getDatabase();
  const nextBackupAt = cadence === "disabled" ? null : new Date(Date.now() + Number(cadence) * 86400_000);
  await db.collection<BackupSettingsRecord>("system_settings").updateOne({ _id: settingsId }, { $set: { cadence, nextBackupAt, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  return { cadence, nextBackupAt };
}

export async function runReservationBackup(source: "panel" | "scheduled" = "panel") {
  const db = await getDatabase();
  const id = new ObjectId();
  const jobs = db.collection<BackupProgress & { _id: string }>("backup_jobs");
  const updateProgress = async (progress: number, stage: string, running = true) => {
    await jobs.updateOne({ _id: "current" }, { $set: { id: id.toHexString(), progress, stage, running, updatedAt: new Date() } }, { upsert: true });
  };
  try {
    await updateProgress(5, "Preparando os dados");
    const [state, menu] = await Promise.all([
    db.collection("app_state").findOne({ key: "main" }),
    db.collection("store_menu").find({ ownerId: { $exists: false } }).toArray(),
    ]);
    await updateProgress(40, "Reunindo reservas e informações financeiras");
    const exportData = {
    format: "refugio-gestao-backup-v1",
    createdAt: new Date().toISOString(),
    data: {
      appState: state ? { cabins: state.cabins ?? [], bookings: state.bookings ?? [], financeEntries: state.financeEntries ?? [], payables: state.payables ?? [], updatedAt: state.updatedAt ?? null } : null,
      storeMenu: menu.map(({ _id, ...item }) => ({ id: _id?.toString(), ...item })),
    },
    };
    const json = JSON.stringify(exportData);
    const compressed = gzipSync(Buffer.from(json), { level: 6 });
    await updateProgress(72, "Salvando o arquivo de backup no MongoDB");
    const bucket = new GridFSBucket(db, { bucketName: "reservation_backups" });
    const filename = `refugio-reservas-${new Date().toISOString().slice(0, 10)}.json.gz`;
    const upload = bucket.openUploadStreamWithId(id, filename, { metadata: { contentType: "application/gzip", format: exportData.format, originalBytes: Buffer.byteLength(json) } });
    await new Promise<void>((resolve, reject) => {
      upload.once("finish", resolve);
      upload.once("error", reject);
      upload.end(compressed);
    });
    const createdAt = new Date();
    await db.collection("backup_history").insertOne({ _id: id, filename, size: compressed.length, createdAt, acknowledged: false, source });
    const settings = await db.collection<BackupSettingsRecord>("system_settings").findOne({ _id: settingsId });
    const nextBackupAt = settings?.cadence && settings.cadence !== "disabled" ? new Date(createdAt.getTime() + Number(settings.cadence) * 86400_000) : null;
    await db.collection<BackupSettingsRecord>("system_settings").updateOne({ _id: settingsId }, { $set: { lastBackupAt: createdAt, lastBackupId: id.toHexString(), nextBackupAt } });
    await updateProgress(100, "Backup concluído", false);
    return { id: id.toHexString(), filename, size: compressed.length, createdAt };
  } catch (error) {
    await updateProgress(0, "Falha ao gerar o backup", false);
    throw error;
  }
}

export async function backupStatus() {
  const db = await getDatabase();
  const [settings, progress, pending] = await Promise.all([
    db.collection<BackupSettingsRecord>("system_settings").findOne({ _id: settingsId }),
    db.collection<BackupProgress & { _id: string }>("backup_jobs").findOne({ _id: "current" }),
    db.collection("backup_history").findOne({ acknowledged: false }, { sort: { createdAt: -1 }, projection: { filename: 1, size: 1, createdAt: 1 } }),
  ]);
  return { cadence: settings?.cadence ?? "disabled", nextBackupAt: settings?.nextBackupAt ?? null, lastBackupAt: settings?.lastBackupAt ?? null, progress: progress ? { id: progress.id, progress: progress.progress, stage: progress.stage, running: progress.running, updatedAt: progress.updatedAt } : null, pending: pending ? { id: pending._id.toString(), filename: pending.filename, size: pending.size, createdAt: pending.createdAt } : null };
}
