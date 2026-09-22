import { get } from "@vercel/blob";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pathname = url.searchParams.get("pathname") ?? "";
  const name = (url.searchParams.get("name") ?? "documento").replace(/[\r\n"]/g, "_");
  if (!pathname.startsWith("reservas/")) return Response.json({ message: "Arquivo inválido." }, { status: 400 });
  const result = await get(pathname, { access: "private" });
  if (!result) return Response.json({ message: "Arquivo não encontrado." }, { status: 404 });
  return new Response(result.stream, { headers: { "Content-Type": result.blob.contentType || "application/octet-stream", "Content-Length": String(result.blob.size), "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" } });
}
