import { GridFSBucket, ObjectId } from "mongodb";
import { authorize, authFailure } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
import { workspaceFor } from "@/lib/workspace";

export const runtime = "nodejs";
export const maxDuration = 60;
const maxImageBytes = 4 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  try {
    const user = await authorize(request, true);
    const workspace = workspaceFor(user, request.headers.get("x-refugio-mode"));
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) return Response.json({ message: "Selecione uma imagem." }, { status: 400 });
    if (!allowedTypes.has(file.type)) return Response.json({ message: "Use uma imagem JPG, PNG, WebP ou GIF." }, { status: 400 });
    if (file.size < 1 || file.size > maxImageBytes) return Response.json({ message: "A imagem deve ter até 4 MB." }, { status: 400 });
    const db = await getDatabase();
    const bucket = new GridFSBucket(db, { bucketName: "store_images" });
    const id = new ObjectId();
    const upload = bucket.openUploadStreamWithId(id, file.name.slice(0, 160), {
      metadata: { contentType: file.type, ownerId: workspace.mode === "beta" ? user._id.toHexString() : null, mode: workspace.mode },
    });
    const bytes = Buffer.from(await file.arrayBuffer());
    await new Promise<void>((resolve, reject) => {
      upload.once("finish", resolve);
      upload.once("error", reject);
      upload.end(bytes);
    });
    return Response.json({ imageUrl: `/api/store/images/${id.toHexString()}` }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && !("status" in error)) return Response.json({ message: "Não foi possível salvar a imagem no MongoDB." }, { status: 503 });
    return authFailure(error);
  }
}
