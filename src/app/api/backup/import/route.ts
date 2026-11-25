import { NextResponse } from "next/server";
import {
  BackupRestoreInProgressError,
  restoreBackup,
} from "@/lib/backup-restore";
import { BackupValidationError } from "@/lib/backup-validation";
import { requireAdmin } from "@/lib/route-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BACKUP_REQUEST_BYTES = 256 * 1024 * 1024;

class ImportRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ImportRequestError";
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    throw new ImportRequestError("Content-Type must be application/json.", 415);
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      throw new ImportRequestError("Invalid Content-Length header.", 400);
    }
    if (Number(contentLength) > MAX_BACKUP_REQUEST_BYTES) {
      throw new ImportRequestError("Backup file exceeds the 256 MB request limit.", 413);
    }
  }

  if (!request.body) throw new ImportRequestError("A backup JSON body is required.", 400);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_BACKUP_REQUEST_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new ImportRequestError("Backup file exceeds the 256 MB request limit.", 413);
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)) as unknown;
  } catch {
    throw new ImportRequestError("Request body must be valid UTF-8 JSON.", 400);
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const backup = await readJsonBody(request);
    await restoreBackup(backup);
    return new Response(null, {
      status: 303,
      headers: {
        Location: new URL("/", request.url).toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ImportRequestError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (error instanceof BackupValidationError) {
      return NextResponse.json(
        { error: "Backup validation failed.", details: error.message },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (error instanceof BackupRestoreInProgressError) {
      return NextResponse.json(
        { error: error.message },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    console.error("Motion Drive backup import failed", error);
    return NextResponse.json(
      { error: "Backup import failed. Check the server logs for details." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
