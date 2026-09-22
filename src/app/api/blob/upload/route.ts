import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("reservas/")) throw new Error("Destino de upload inválido.");
        return { maximumSizeInBytes: 5_000_000_000_000, addRandomSuffix: true, allowOverwrite: false, validUntil: Date.now() + 15 * 60 * 1000 };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao preparar o upload.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
