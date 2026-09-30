import { getDatabase } from "@/lib/mongodb";
import { authorize, authFailure } from "@/lib/auth";
import { workspaceFor } from "@/lib/workspace";

export const runtime = "nodejs";

type StoredState = { key: string; cabins: unknown[]; bookings: unknown[]; financeEntries: unknown[]; payables: unknown[]; updatedAt: Date };

export async function GET(request: Request) {
  try {
  const user = await authorize();
  const workspace = workspaceFor(user, request.headers.get("x-refugio-mode"));
  const database = await getDatabase();
  if (workspace.mode === "beta") {
    const collection = database.collection<StoredState>(workspace.collection);
    await collection.createIndex({ key: 1 }, { unique: true });
    if (!await collection.findOne({ key: workspace.key })) {
      const original = await database.collection<StoredState>("app_state").findOne({ key: "main" });
      await collection.updateOne({ key: workspace.key }, { $setOnInsert: { key: workspace.key, cabins: original?.cabins ?? [], bookings: [], financeEntries: [], payables: [], updatedAt: new Date() } }, { upsert: true });
    }
  }
  const state = await database.collection<StoredState>(workspace.collection).findOne({ key: workspace.key });
  return Response.json({ cabins: state?.cabins ?? null, bookings: state?.bookings ?? null, financeEntries: state?.financeEntries ?? [], payables: state?.payables ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return authFailure(error); }
}

export async function PUT(request: Request) {
  try {
  const user = await authorize(request);
  const workspace = workspaceFor(user, request.headers.get("x-refugio-mode"));
  const body = await request.json();
  if (!Array.isArray(body.cabins) || !Array.isArray(body.bookings) || !Array.isArray(body.financeEntries) || !Array.isArray(body.payables)) return Response.json({ message: "Estado inválido." }, { status: 400 });
  const database = await getDatabase();
  await database.collection<StoredState>(workspace.collection).updateOne(
    { key: workspace.key },
    { $set: { key: workspace.key, cabins: body.cabins, bookings: body.bookings, financeEntries: body.financeEntries, payables: body.payables, updatedAt: new Date() } },
    { upsert: true },
  );
  return Response.json({ saved: true });
  } catch (error) { return authFailure(error); }
}
