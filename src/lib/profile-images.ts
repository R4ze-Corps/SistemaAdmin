import { GridFSBucket, ObjectId } from "mongodb";
import { getDatabase } from "./mongodb";
import { AuthError } from "./auth";

export const maxProfileImageBytes = 4 * 1024 * 1024;

function imageType(bytes: Buffer) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"))) return "image/gif";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (bytes.length >= 2 && bytes.subarray(0, 2).toString("ascii") === "BM") return "image/bmp";
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp" && /^(avif|avis)$/.test(bytes.subarray(8, 12).toString("ascii"))) return "image/avif";
  return null;
}

function bucketFor(db: Awaited<ReturnType<typeof getDatabase>>) {
  return new GridFSBucket(db, { bucketName: "profile_images" });
}

export async function storeProfileImage(file: File, ownerId: ObjectId) {
  if (file.size < 1 || file.size > maxProfileImageBytes) throw new AuthError("A foto deve ter até 4 MB.", 400);
  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = imageType(bytes);
  if (!contentType) throw new AuthError("Formato não reconhecido. Use GIF, JPEG/JFIF, PNG, WebP, AVIF ou BMP.", 400);

  const db = await getDatabase();
  const bucket = bucketFor(db);
  const id = new ObjectId();
  const upload = bucket.openUploadStreamWithId(id, `avatar-${ownerId.toHexString()}`, {
    metadata: { contentType, ownerId: ownerId.toHexString() },
  });
  await new Promise<void>((resolve, reject) => {
    upload.once("finish", resolve);
    upload.once("error", reject);
    upload.end(bytes);
  });
  return { id, contentType };
}

export async function deleteProfileImage(id: ObjectId) {
  const db = await getDatabase();
  try { await bucketFor(db).delete(id); }
  catch (error) { if ((error as { code?: number }).code !== 26) throw error; }
}
