import { getDatabase } from "@/lib/mongodb";
import { authorize, authFailure } from "@/lib/auth";

export const runtime = "nodejs";

type StoredState = { key: "main"; cabins: unknown[]; bookings: unknown[]; financeEntries: unknown[]; payables: unknown[]; updatedAt: Date };

export async function GET() {
  try {
  await authorize();
  const database = await getDatabase();
  const state = await database.collection<StoredState>("app_state").findOne({ key: "main" });
  return Response.json({ cabins: state?.cabins ?? null, bookings: state?.bookings ?? null, financeEntries: state?.financeEntries ?? [], payables: state?.payables ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return authFailure(error); }
}

export async function PUT(request: Request) {
  try {
  await authorize(request);
  const body = await request.json();
  if (!Array.isArray(body.cabins) || !Array.isArray(body.bookings) || !Array.isArray(body.financeEntries) || !Array.isArray(body.payables)) return Response.json({ message: "Estado inválido." }, { status: 400 });
  const database = await getDatabase();
  await database.collection<StoredState>("app_state").updateOne(
    { key: "main" },
    { $set: { key: "main", cabins: body.cabins, bookings: body.bookings, financeEntries: body.financeEntries, payables: body.payables, updatedAt: new Date() } },
    { upsert: true },
  );
  return Response.json({ saved: true });
  } catch (error) { return authFailure(error); }
}
