import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { deleteStoredFile } from "@/lib/storage";
import { isoDateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const expiryUpdateSchema = z.object({
  expiryDate: z.preprocess(
    (value) => (value === "" ? null : value),
    isoDateSchema.nullable(),
  ),
});

function expiryDateOrNull(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const parsed = expiryUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid expiry date.", details: z.prettifyError(parsed.error) },
        { status: 400 },
      );
    }

    const document = await prisma.document.update({
      where: { id },
      data: { expiryDate: expiryDateOrNull(parsed.data.expiryDate) },
    });
    return NextResponse.json(
      { document: { ...document, sizeBytes: document.sizeBytes.toString() } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
    console.error("Document expiry update failed", error);
    return NextResponse.json(
      { error: "Could not update the document expiry." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, storedName: true },
    });
    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    await prisma.document.delete({ where: { id } });
    await deleteStoredFile(document.storedName);
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
    console.error("Document delete failed", error);
    return NextResponse.json(
      { error: "Could not delete the document." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
