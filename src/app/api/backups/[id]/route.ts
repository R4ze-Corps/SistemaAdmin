import { GridFSBucket, ObjectId } from "mongodb";
import { authorize, AuthError } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext<"/api/backups/[id]">) {
  try {
    const user = await authorize(request, true);
    if (user.preferences?.betaEnabled) throw new AuthError("Volte ao modo normal para acessar o backup.", 409);
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) throw new AuthError("Backup não encontrado.", 404);
    const db = await getDatabase();
    const record = await db.collection("backup_history").findOne({ _id: new ObjectId(id) });
    if (!record) throw new AuthError("Backup não encontrado.", 404);
    const bucket = new GridFSBucket(db, { bucketName: "reservation_backups" });
    const chunks: Buffer[] = [];
    for await (const chunk of bucket.openDownloadStream(new ObjectId(id))) chunks.push(Buffer.from(chunk));
    return new Response(Buffer.concat(chunks), { headers: { "Content-Type": "application/gzip", "Content-Length": String(record.size), "Content-Disposition": `attachment; filename="${record.filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return Response.json({ message: error instanceof AuthError ? error.message : "Não foi possível baixar o backup." }, { status: error instanceof AuthError ? error.status : 503 });
  }
}
