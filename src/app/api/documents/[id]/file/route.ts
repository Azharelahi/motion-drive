import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readStoredFile } from "@/lib/storage";
import { requireAdmin } from "@/lib/route-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function contentDispositionFilename(name: string): string {
  const fallback = name.replace(/[^\x20-\x7e]|["\\;]/g, "_");
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  try {
    const document = await prisma.document.findUnique({
      where: { id },
      select: { storedName: true, originalName: true, mimeType: true },
    });
    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    const data = await readStoredFile(document.storedName);
    const download =
      new URL(request.url).searchParams.get("download") === "1" ||
      document.mimeType === "text/html";

    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": data.byteLength.toString(),
        "Content-Disposition": `${download ? "attachment" : "inline"}; ${contentDispositionFilename(document.originalName)}`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
      },
    });
  } catch (error) {
    console.error("Document file read failed", error);
    return NextResponse.json(
      { error: "Could not read the document file." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
