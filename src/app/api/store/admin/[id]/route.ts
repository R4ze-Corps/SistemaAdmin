import { ObjectId } from "mongodb";
import { authorize, authFailure } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
import { workspaceFor } from "@/lib/workspace";

export const runtime = "nodejs";
type MenuItem = { _id?: ObjectId; ownerId?: string; name: string; description: string; category: string; price: number; imageUrl?: string; available: boolean; featured: boolean; createdAt: Date; updatedAt: Date };

function inputFrom(body: unknown) {
  if (!body || typeof body !== "object") throw new Error("Preencha os dados do item.");
  const v = body as Record<string, unknown>;
  const name = typeof v.name === "string" ? v.name.trim() : "";
  const description = typeof v.description === "string" ? v.description.trim() : "";
  const category = typeof v.category === "string" ? v.category.trim() : "";
  const price = Number(v.price);
  const imageUrl = typeof v.imageUrl === "string" ? v.imageUrl.trim() : "";
  if (!name || name.length > 100) throw new Error("Informe um nome com até 100 caracteres.");
  if (description.length > 500) throw new Error("A descrição pode ter até 500 caracteres.");
  if (!category || category.length > 40) throw new Error("Informe uma categoria com até 40 caracteres.");
  if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) throw new Error("Informe um preço válido.");
  const storedImage = /^\/api\/store\/images\/[a-f0-9]{24}$/i.test(imageUrl);
  if (imageUrl.length > 2000 || (imageUrl && !storedImage && (!/^https:\/\//i.test(imageUrl) || !URL.canParse(imageUrl)))) throw new Error("Use um endereço HTTPS válido ou envie uma imagem do computador.");
  if (typeof v.available !== "boolean" || typeof v.featured !== "boolean") throw new Error("Escolha a disponibilidade e o destaque do item.");
  return { name, description, category, price, imageUrl, available: v.available, featured: v.featured, updatedAt: new Date() };
}

export async function PATCH(request: Request, context: RouteContext<"/api/store/admin/[id]">) {
  try {
    const user = await authorize(request, true);
    const workspace = workspaceFor(user, request.headers.get("x-refugio-mode"));
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) return Response.json({ message: "Item inválido." }, { status: 400 });
    const beta = workspace.mode === "beta";
    const owner = beta ? { ownerId: user._id.toHexString() } : { ownerId: { $exists: false } };
    const result = await (await getDatabase()).collection<MenuItem>("store_menu").findOneAndUpdate({ _id: new ObjectId(id), ...owner }, { $set: inputFrom(await request.json()) }, { returnDocument: "after" });
    if (!result) return Response.json({ message: "Item não encontrado." }, { status: 404 });
    const { _id, ...item } = result;
    return Response.json({ item: { id: _id?.toHexString(), ...item } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && !("status" in error)) return Response.json({ message: error.message }, { status: 400 });
    return authFailure(error);
  }
}

export async function DELETE(request: Request, context: RouteContext<"/api/store/admin/[id]">) {
  try {
    const user = await authorize(request, true);
    const workspace = workspaceFor(user, request.headers.get("x-refugio-mode"));
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) return Response.json({ message: "Item inválido." }, { status: 400 });
    const owner = workspace.mode === "beta" ? { ownerId: user._id.toHexString() } : { ownerId: { $exists: false } };
    const result = await (await getDatabase()).collection<MenuItem>("store_menu").deleteOne({ _id: new ObjectId(id), ...owner });
    if (!result.deletedCount) return Response.json({ message: "Item não encontrado." }, { status: 404 });
    return Response.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return authFailure(error); }
}
