import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  deleteStoredFile,
  MAX_UPLOAD_BYTES,
  saveUpload,
  StorageValidationError,
  type StoredUpload,
} from "@/lib/storage";
import { documentEntityTypeSchema, isoDateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const uploadFieldsSchema = z.object({
  entityType: documentEntityTypeSchema,
  entityId: z.string().trim().min(1),
  documentType: z.string().trim().min(1).max(100),
  expiryDate: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    isoDateSchema.optional(),
  ),
});

class DocumentRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "DocumentRequestError";
  }
}

function expiryDateOrNull(value: string | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

async function removeSavedUploads(uploads: StoredUpload[]): Promise<void> {
  for (const upload of uploads) {
    try {
      await deleteStoredFile(upload.storedName);
    } catch (error) {
      console.error(`Could not clean up uploaded file ${upload.storedName}`, error);
    }
  }
}

export async function POST(request: Request) {
  const savedUploads: StoredUpload[] = [];
  try {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
      throw new DocumentRequestError("Content-Type must be multipart/form-data.", 415);
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw new DocumentRequestError("Request body must be valid multipart form data.", 400);
    }

    const parsedFields = uploadFieldsSchema.safeParse({
      entityType: formData.get("entityType"),
      entityId: formData.get("entityId"),
      documentType: formData.get("documentType"),
      expiryDate: formData.get("expiryDate"),
    });
    if (!parsedFields.success) {
      throw new DocumentRequestError(
        `Invalid document details. ${z.prettifyError(parsedFields.error)}`,
        400,
      );
    }

    const files = formData.getAll("files");
    if (files.length === 0) {
      throw new DocumentRequestError("Choose at least one file to upload.", 400);
    }
    if (files.some((file) => typeof file === "string" || !(file instanceof File))) {
      throw new DocumentRequestError("Every uploaded file must be a file.", 400);
    }
    const uploadFiles = files as File[];
    const oversizedFile = uploadFiles.find((file) => file.size > MAX_UPLOAD_BYTES);
    if (oversizedFile) {
      throw new DocumentRequestError(
        `${oversizedFile.name} exceeds the 25 MB per-file limit.`,
        413,
      );
    }

    const { entityType, entityId, documentType, expiryDate } = parsedFields.data;
    const owner =
      entityType === "Driver"
        ? await prisma.driver.findUnique({ where: { id: entityId }, select: { id: true } })
        : await prisma.vehicle.findUnique({ where: { id: entityId }, select: { id: true } });
    if (!owner) {
      throw new DocumentRequestError(`${entityType} profile not found.`, 404);
    }

    for (const file of uploadFiles) {
      const data = new Uint8Array(await file.arrayBuffer());
      savedUploads.push(
        await saveUpload({
          originalName: file.name,
          mimeType: file.type,
          data,
        }),
      );
    }

    const documents = await prisma.$transaction(async (transaction) => {
      const created = [];
      for (const upload of savedUploads) {
        created.push(
          await transaction.document.create({
            data: {
              entityType,
              documentType,
              originalName: upload.originalName,
              storedName: upload.storedName,
              storagePath: upload.storagePath,
              mimeType: upload.mimeType,
              sizeBytes: BigInt(upload.sizeBytes),
              expiryDate: expiryDateOrNull(expiryDate),
              driverId: entityType === "Driver" ? entityId : null,
              vehicleId: entityType === "Vehicle" ? entityId : null,
            },
          }),
        );
      }
      return created;
    });

    return NextResponse.json(
      {
        documents: documents.map((document) => ({
          ...document,
          sizeBytes: document.sizeBytes.toString(),
        })),
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (savedUploads.length > 0) await removeSavedUploads(savedUploads);
    if (error instanceof DocumentRequestError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (error instanceof StorageValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { error: "The selected profile no longer exists." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error("Document upload failed", error);
    return NextResponse.json(
      { error: "Document upload failed. Check the server logs for details." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
