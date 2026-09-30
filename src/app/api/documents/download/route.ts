import { get } from "@vercel/blob";
import { authorize, authFailure } from "@/lib/auth";
import { assertDocument, workspaceFor } from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
  const user = await authorize();
  const url = new URL(request.url);
  const pathname = url.searchParams.get("pathname") ?? "";
  const workspace = workspaceFor(user, url.searchParams.get("mode"));
  const name = (url.searchParams.get("name") ?? "documento").replace(/[\r\n"]/g, "_");
  assertDocument(pathname, workspace.documentPrefix);
  const result = await get(pathname, { access: "private" });
  if (!result) return Response.json({ message: "Arquivo não encontrado." }, { status: 404 });
  return new Response(result.stream, { headers: { "Content-Type": result.blob.contentType || "application/octet-stream", "Content-Length": String(result.blob.size), "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" } });
  } catch (error) { return authFailure(error); }
}
