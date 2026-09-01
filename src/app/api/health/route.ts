import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET() {
  try {
    const database = await getDatabase();
    await database.command({ ping: 1 });
    return Response.json({ connected: true, database: database.databaseName });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao conectar ao MongoDB.";
    return Response.json({ connected: false, message }, { status: 503 });
  }
}