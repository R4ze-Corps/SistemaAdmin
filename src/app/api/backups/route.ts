import { authorize, authFailure, AuthError } from "@/lib/auth";
import { backupStatus, runReservationBackup, saveBackupCadence, type BackupCadence } from "@/lib/backup";
import { getDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export const runtime = "nodejs";
export const maxDuration = 60;

async function assertProductionAdmin(request: Request) {
  const user = await authorize(request, true);
  if (user.preferences?.betaEnabled) throw new AuthError("Volte ao modo normal para gerenciar backups.", 409);
  return user;
}

export async function GET(request: Request) {
  try {
    await assertProductionAdmin(request);
    return Response.json(await backupStatus(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return authFailure(error); }
}

export async function PATCH(request: Request) {
  try {
    await assertProductionAdmin(request);
    const body = await request.json();
    const db = await getDatabase();
    if (body.action === "schedule") {
      if (!["disabled", "3", "15", "30"].includes(body.cadence)) throw new AuthError("Escolha um intervalo válido para o backup.", 400);
      const settings = await saveBackupCadence(body.cadence as BackupCadence);
      return Response.json({ settings, message: body.cadence === "disabled" ? "Backup automático desativado." : `Backup automático a cada ${body.cadence} dias.` });
    }
    if (body.action === "acknowledge" && typeof body.id === "string" && ObjectId.isValid(body.id)) {
      await db.collection("backup_history").updateOne({ _id: new ObjectId(body.id) }, { $set: { acknowledged: true, acknowledgedAt: new Date() } });
      return Response.json({ acknowledged: true });
    }
    throw new AuthError("Ação de backup inválida.", 400);
  } catch (error) { return authFailure(error); }
}

export async function POST(request: Request) {
  try {
    await assertProductionAdmin(request);
    const status = await backupStatus();
    if (status.progress?.running) throw new AuthError("Já existe um backup em andamento.", 409);
    const backup = await runReservationBackup("panel");
    return Response.json({ backup, message: "Backup concluído e salvo no MongoDB." }, { status: 201 });
  } catch (error) { return authFailure(error); }
}
