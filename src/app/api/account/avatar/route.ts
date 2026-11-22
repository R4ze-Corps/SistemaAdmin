import { GridFSBucket, ObjectId } from "mongodb";
import { authorize, AuthError, authFailure, publicAccount } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
import { deleteProfileImage, maxProfileImageBytes, storeProfileImage } from "@/lib/profile-images";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const user = await authorize(request);
    if (!user.avatarId) throw new AuthError("Foto de perfil não encontrada.", 404);
    const bucket = new GridFSBucket(await getDatabase(), { bucketName: "profile_images" });
    const file = await bucket.find({ _id: user.avatarId }).next();
    if (!file) throw new AuthError("Foto de perfil não encontrada.", 404);
    const metadata = file.metadata as { ownerId?: string; contentType?: string } | undefined;
    if (metadata?.ownerId !== user._id.toHexString()) throw new AuthError("Foto de perfil não encontrada.", 404);
    const chunks: Buffer[] = [];
    for await (const chunk of bucket.openDownloadStream(user.avatarId)) chunks.push(Buffer.from(chunk));
    const contentType = metadata.contentType ?? "application/octet-stream";
    return new Response(Buffer.concat(chunks), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(file.length),
        "Cache-Control": "private, max-age=3600, immutable",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) { return authFailure(error); }
}

export async function POST(request: Request) {
  let newImageId: ObjectId | null = null;
  try {
    const user = await authorize(request);
    if (user.preferences?.betaEnabled) throw new AuthError("Desative o Modo Beta para alterar sua foto de perfil.", 409);
    if (Number(request.headers.get("content-length") || 0) > maxProfileImageBytes + 128_000) throw new AuthError("A foto deve ter até 4 MB.", 413);
    const form = await request.formData().catch(() => { throw new AuthError("Selecione uma foto de perfil.", 400); });
    const file = form.get("avatar");
    if (!(file instanceof File) || file.size < 1) throw new AuthError("Selecione uma foto de perfil.", 400);
    const image = await storeProfileImage(file, user._id);
    newImageId = image.id;
    const updatedAt = new Date();
    const result = await (await getDatabase()).collection("users").updateOne(
      { _id: user._id, passwordHash: user.passwordHash },
      { $set: { avatarId: image.id, avatarUpdatedAt: updatedAt } },
    );
    if (!result.matchedCount) throw new AuthError("A conta mudou em outra sessão. Recarregue e tente novamente.", 409);
    if (user.avatarId) await deleteProfileImage(user.avatarId).catch(() => undefined);
    user.avatarId = image.id;
    user.avatarUpdatedAt = updatedAt;
    return Response.json({ user: publicAccount(user), message: "Foto de perfil atualizada." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (newImageId) await deleteProfileImage(newImageId).catch(() => undefined);
    return authFailure(error);
  }
}
