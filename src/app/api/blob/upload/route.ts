import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { authorize, authFailure } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        await authorize(request);
        if (!pathname.startsWith("reservas/")) throw new Error("Destino de upload inválido.");
        return { maximumSizeInBytes: 5_000_000_000_000, addRandomSuffix: true, allowOverwrite: false, validUntil: Date.now() + 15 * 60 * 1000 };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return authFailure(error);
  }
}
