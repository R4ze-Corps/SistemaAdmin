import { GridFSBucket, ObjectId } from "mongodb";
import { authorize, AuthError } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
import { workspaceFor } from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext<"/api/store/images/[id]">) {
  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) return Response.json({ message: "Imagem não encontrada." }, { status: 404 });
    const db = await getDatabase();
    const bucket = new GridFSBucket(db, { bucketName: "store_images" });
    const file = await bucket.find({ _id: new ObjectId(id) }).next();
    if (!file) return Response.json({ message: "Imagem não encontrada." }, { status: 404 });
    const metadata = file.metadata as { mode?: string; ownerId?: string; contentType?: string } | undefined;
    if (metadata?.mode === "beta") {
      const user = await authorize(request);
      const workspace = workspaceFor(user, "beta");
      if (workspace.mode !== "beta" || workspace.key !== metadata.ownerId) throw new AuthError("Imagem não encontrada.", 404);
    }
    const chunks: Buffer[] = [];
    for await (const chunk of bucket.openDownloadStream(new ObjectId(id))) chunks.push(Buffer.from(chunk));
    const contentType = typeof metadata?.contentType === "string" ? metadata.contentType : "application/octet-stream";
    return new Response(Buffer.concat(chunks), { headers: { "Content-Type": contentType, "Content-Length": String(file.length), "Cache-Control": "public, max-age=86400, immutable", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return Response.json({ message: error instanceof AuthError ? error.message : "Não foi possível carregar a imagem." }, { status: error instanceof AuthError ? error.status : 503 });
  }
}
