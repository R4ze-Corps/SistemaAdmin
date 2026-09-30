import { del } from "@vercel/blob";
import { authorize, authFailure } from "@/lib/auth";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
  await authorize(request);
  const pathname = new URL(request.url).searchParams.get("pathname") ?? "";
  if (!pathname.startsWith("reservas/")) return Response.json({ message: "Arquivo inválido." }, { status: 400 });
  await del(pathname);
  return Response.json({ deleted: true });
  } catch (error) { return authFailure(error); }
}
