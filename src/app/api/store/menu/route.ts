import { getDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

type MenuItem = {
  _id: unknown;
  name: string;
  description: string;
  category: string;
  price: number;
  imageUrl?: string;
  available: boolean;
  featured: boolean;
};

// This endpoint intentionally exposes only published menu fields. It does not
// read the chalet workspace, reservations, customer documents, or finances.
export async function GET() {
  try {
    const items = await (await getDatabase()).collection<MenuItem>("store_menu")
      .find({ available: true }, { projection: { name: 1, description: 1, category: 1, price: 1, imageUrl: 1, featured: 1 } })
      .sort({ featured: -1, category: 1, name: 1 }).toArray();
    return Response.json({ items: items.map(({ _id, ...item }) => ({ id: String(_id), ...item })) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ message: "Não foi possível carregar o cardápio." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
