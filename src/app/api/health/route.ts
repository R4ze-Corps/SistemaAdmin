import { getDatabase } from "@/lib/mongodb";
import { authorize, authFailure } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    await authorize();
    const database = await getDatabase();
    await database.command({ ping: 1 });
    return Response.json({ connected: true, database: database.databaseName });
  } catch (error) {
    return authFailure(error);
  }
}
