import { gunzipSync } from "node:zlib";
import { ObjectId } from "mongodb";
import { AuthError, authorize, authFailure } from "@/lib/auth";
import { getDatabase, getMongoClient } from "@/lib/mongodb";

export const runtime = "nodejs";
export const maxDuration = 60;
const maxCompressedBytes = 4 * 1024 * 1024;
const maxExpandedBytes = 64 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function dateOrNow(value: unknown) {
  const date = typeof value === "string" || value instanceof Date ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function parseBackup(value: unknown) {
  if (!isRecord(value) || value.format !== "refugio-gestao-backup-v1" || !isRecord(value.data)) throw new AuthError("Este arquivo não é um backup compatível do Refúgio Gestão.", 400);
  const state = value.data.appState;
  const appState = state === null ? { cabins: [], bookings: [], financeEntries: [], payables: [] } : state;
  if (!isRecord(appState) || !Array.isArray(appState.cabins) || !Array.isArray(appState.bookings) || !Array.isArray(appState.financeEntries) || !Array.isArray(appState.payables)) throw new AuthError("O arquivo está incompleto ou corrompido.", 400);
  const totalRecords = appState.cabins.length + appState.bookings.length + appState.financeEntries.length + appState.payables.length;
  if (totalRecords > 50_000) throw new AuthError("O backup excede o limite de registros permitido.", 413);
  if (!Array.isArray(value.data.storeMenu) || value.data.storeMenu.length > 5_000) throw new AuthError("A lista do cardápio no arquivo é inválida.", 400);
  const menu = value.data.storeMenu.map((entry) => {
    if (!isRecord(entry) || typeof entry.name !== "string" || !entry.name.trim() || entry.name.length > 100 || typeof entry.category !== "string" || !entry.category.trim() || entry.category.length > 40 || typeof entry.description !== "string" || entry.description.length > 500 || typeof entry.price !== "number" || !Number.isFinite(entry.price) || entry.price <= 0 || entry.price > 1_000_000 || typeof entry.available !== "boolean" || typeof entry.featured !== "boolean") throw new AuthError("Há um item inválido no cardápio do backup.", 400);
    const imageUrl = typeof entry.imageUrl === "string" ? entry.imageUrl : "";
    if (imageUrl && !(/^https:\/\//i.test(imageUrl) && URL.canParse(imageUrl)) && !/^\/api\/store\/images\/[a-f0-9]{24}$/i.test(imageUrl)) throw new AuthError("O backup contém um endereço de imagem inválido.", 400);
    const originalId = typeof entry.id === "string" && ObjectId.isValid(entry.id) ? new ObjectId(entry.id) : new ObjectId();
    return { _id: originalId, name: entry.name.trim(), category: entry.category.trim(), description: entry.description, price: entry.price, ...(imageUrl ? { imageUrl } : {}), available: entry.available, featured: entry.featured, createdAt: dateOrNow(entry.createdAt), updatedAt: dateOrNow(entry.updatedAt) };
  });
  return { appState, menu, counts: { cabins: appState.cabins.length, bookings: appState.bookings.length, financeEntries: appState.financeEntries.length, payables: appState.payables.length, menuItems: menu.length } };
}

export async function POST(request: Request) {
  try {
    const user = await authorize(request, true);
    if (user.preferences?.betaEnabled) throw new AuthError("Desative o Modo Beta para restaurar os dados reais.", 409);
    const length = Number(request.headers.get("content-length") || 0);
    if (length > maxCompressedBytes + 128 * 1024) throw new AuthError("O arquivo de backup compactado deve ter até 4 MB.", 413);
    const form = await request.formData();
    const uploaded = form.get("backup");
    if (!(uploaded instanceof File) || uploaded.size < 3 || uploaded.size > maxCompressedBytes) throw new AuthError("Anexe um arquivo de backup .json.gz de até 4 MB.", 400);
    const compressed = Buffer.from(await uploaded.arrayBuffer());
    if (compressed[0] !== 0x1f || compressed[1] !== 0x8b) throw new AuthError("O arquivo deve ser o backup compactado .json.gz baixado do sistema.", 400);
    let decoded: unknown;
    try { decoded = JSON.parse(gunzipSync(compressed, { maxOutputLength: maxExpandedBytes }).toString("utf8")); }
    catch { throw new AuthError("Não foi possível ler o backup: arquivo inválido, corrompido ou acima do limite de 64 MB descompactado.", 400); }
    const parsed = parseBackup(decoded);
    const db = await getDatabase();
    const client = await getMongoClient();
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        await db.collection("app_state").replaceOne({ key: "main" }, { key: "main", cabins: parsed.appState.cabins, bookings: parsed.appState.bookings, financeEntries: parsed.appState.financeEntries, payables: parsed.appState.payables, updatedAt: new Date() }, { upsert: true, session });
        await db.collection("store_menu").deleteMany({ ownerId: { $exists: false } }, { session });
        if (parsed.menu.length) await db.collection("store_menu").insertMany(parsed.menu, { session, ordered: true });
      });
    } finally { await session.endSession(); }
    return Response.json({ restored: true, counts: parsed.counts, message: "Backup validado e restaurado. Reservas, chalés, financeiro e cardápio foram substituídos pelos dados do arquivo." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && !(error instanceof AuthError)) return Response.json({ message: "Não foi possível restaurar o backup. Nenhum dado foi substituído." }, { status: 503 });
    return authFailure(error);
  }
}
