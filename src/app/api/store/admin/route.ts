import { ObjectId } from "mongodb";
import { authorize, authFailure } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";
import { workspaceFor } from "@/lib/workspace";
import { sectionForLegacyItem } from "@/lib/store-menu";

export const runtime = "nodejs";

type MenuItem = { _id?: ObjectId; ownerId?: string; name: string; description: string; category: string; section?: "wine" | "products" | "services"; price: number; imageUrl?: string; available: boolean; featured: boolean; createdAt: Date; updatedAt: Date };
type MenuInput = Omit<MenuItem, "_id" | "ownerId" | "createdAt" | "updatedAt"> & { section: "wine" | "products" | "services" };

function inputFrom(body: unknown): MenuInput {
  if (!body || typeof body !== "object") throw new Error("Preencha os dados do item.");
  const value = body as Record<string, unknown>;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const description = typeof value.description === "string" ? value.description.trim() : "";
  const category = typeof value.category === "string" ? value.category.trim() : "";
  const section = value.section === "products" || value.section === "services" ? value.section : value.section === "wine" ? "wine" : "";
  const price = Number(value.price);
  const imageUrl = typeof value.imageUrl === "string" ? value.imageUrl.trim() : "";
  if (!name || name.length > 100) throw new Error("Informe um nome com até 100 caracteres.");
  if (description.length > 500) throw new Error("A descrição pode ter até 500 caracteres.");
  if (!category || category.length > 40) throw new Error("Informe uma categoria com até 40 caracteres.");
  if (!section) throw new Error("Escolha entre Adega, Outros produtos e Serviços.");
  if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) throw new Error("Informe um preço válido.");
  const storedImage = /^\/api\/store\/images\/[a-f0-9]{24}$/i.test(imageUrl);
  if (imageUrl.length > 2000 || (imageUrl && !storedImage && (!/^https:\/\//i.test(imageUrl) || !URL.canParse(imageUrl)))) throw new Error("Use um endereço HTTPS válido ou envie uma imagem do computador.");
  if (typeof value.available !== "boolean" || typeof value.featured !== "boolean") throw new Error("Escolha a disponibilidade e o destaque do item.");
  return { name, description, category, section, price, imageUrl, available: value.available, featured: value.featured };
}

function criteria(user: Awaited<ReturnType<typeof authorize>>, beta: boolean) {
  return beta ? { ownerId: user._id.toHexString() } : { ownerId: { $exists: false } };
}

export async function GET(request: Request) {
  try {
    const user = await authorize(request, true);
    const workspace = workspaceFor(user, request.headers.get("x-refugio-mode"));
    const beta = workspace.mode === "beta";
    const items = await (await getDatabase()).collection<MenuItem>("store_menu").find(criteria(user, beta)).sort({ updatedAt: -1, name: 1 }).toArray();
    return Response.json({ items: items.map(({ _id, ...item }) => ({ id: _id?.toHexString(), ...item, section: item.section ?? sectionForLegacyItem(item.name, item.category) })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return authFailure(error); }
}

export async function POST(request: Request) {
  try {
    const user = await authorize(request, true);
    const workspace = workspaceFor(user, request.headers.get("x-refugio-mode"));
    const item = inputFrom(await request.json());
    const beta = workspace.mode === "beta";
    const document: MenuItem = { ...item, ...(beta ? { ownerId: user._id.toHexString() } : {}), createdAt: new Date(), updatedAt: new Date() };
    const result = await (await getDatabase()).collection<MenuItem>("store_menu").insertOne(document);
    return Response.json({ item: { id: result.insertedId.toHexString(), ...document } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && !("status" in error)) return Response.json({ message: error.message }, { status: 400 });
    return authFailure(error);
  }
}
