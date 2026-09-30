import { del } from "@vercel/blob";
import { authorize, authFailure } from "@/lib/auth";
import { assertDocument, workspaceFor } from "@/lib/workspace";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
  const user = await authorize(request);
  const workspace = workspaceFor(user, request.headers.get("x-refugio-mode"));
  const pathname = new URL(request.url).searchParams.get("pathname") ?? "";
  assertDocument(pathname, workspace.documentPrefix);
  await del(pathname);
  return Response.json({ deleted: true });
  } catch (error) { return authFailure(error); }
}
