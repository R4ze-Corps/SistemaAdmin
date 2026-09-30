import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { authorize, authFailure } from "@/lib/auth";
import { assertDocument, workspaceFor } from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        const user = await authorize(request);
        const workspace = workspaceFor(user, pathname.startsWith("beta/") ? "beta" : "production");
        assertDocument(pathname, workspace.documentPrefix);
        return { maximumSizeInBytes: 5_000_000_000_000, addRandomSuffix: true, allowOverwrite: false, validUntil: Date.now() + 15 * 60 * 1000 };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return authFailure(error);
  }
}
