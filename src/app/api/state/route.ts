import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

type StoredState = { key: "main"; cabins: unknown[]; bookings: unknown[]; financeEntries: unknown[]; updatedAt: Date };

export async function GET() {
  const database = await getDatabase();
  const state = await database.collection<StoredState>("app_state").findOne({ key: "main" });
  return Response.json({ cabins: state?.cabins ?? null, bookings: state?.bookings ?? null, financeEntries: state?.financeEntries ?? [] });
}

export async function PUT(request: Request) {
  const body = await request.json();
  if (!Array.isArray(body.cabins) || !Array.isArray(body.bookings) || !Array.isArray(body.financeEntries)) return Response.json({ message: "Estado inválido." }, { status: 400 });
  const database = await getDatabase();
  await database.collection<StoredState>("app_state").updateOne(
    { key: "main" },
    { $set: { key: "main", cabins: body.cabins, bookings: body.bookings, financeEntries: body.financeEntries, updatedAt: new Date() } },
    { upsert: true },
  );
  return Response.json({ saved: true });
}
