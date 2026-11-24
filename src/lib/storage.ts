import { randomUUID } from "node:crypto";
import { access, lstat, mkdir, open, readFile as readFileFromDisk, readdir, unlink } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const UPLOAD_DIRECTORY = path.resolve(process.cwd(), "storage", "uploads");

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  ".pdf": "application/pdf",
  ".html": "text/html",
  ".htm": "text/html",
  ".txt": "text/plain",
  ".json": "application/json",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".avif": "image/avif",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

const STORED_NAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:pdf|html?|txt|json|docx?|jpe?g|png|gif|webp|bmp|tiff?|avif|heic|heif)$/i;

export class StorageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageValidationError";
  }
}

export interface SaveUploadInput {
  originalName: string;
  mimeType: string;
  data: Uint8Array;
}

export interface StoredUpload {
  storedName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
}

export interface StoredFileInfo {
  storedName: string;
  sizeBytes: number;
  modifiedAt: Date;
}

function safeOriginalName(originalName: string): string {
  const filename = originalName.replace(/\\/g, "/").split("/").pop()?.trim() ?? "";
  const cleaned = filename.replace(/[\u0000-\u001f\u007f]/g, "");

  if (!cleaned || cleaned === "." || cleaned === "..") {
    throw new StorageValidationError("A valid file name is required.");
  }
  if (cleaned.length > 255) {
    throw new StorageValidationError("File names must be 255 characters or fewer.");
  }

  return cleaned;
}

function validateUpload(originalName: string, mimeType: string, data: Uint8Array) {
  if (data.byteLength > MAX_UPLOAD_BYTES) {
    throw new StorageValidationError("Files must be 25 MB or smaller.");
  }

  const extension = path.extname(originalName).toLowerCase();
  const expectedMimeType = MIME_BY_EXTENSION[extension];
  if (!expectedMimeType) {
    throw new StorageValidationError("This file type is not allowed.");
  }

  const suppliedMimeType = mimeType.split(";", 1)[0]?.trim().toLowerCase();
  if (suppliedMimeType && suppliedMimeType !== expectedMimeType) {
    throw new StorageValidationError("The file name and file type do not match.");
  }

  return { extension, mimeType: expectedMimeType };
}

async function ensureUploadDirectory(): Promise<void> {
  await mkdir(UPLOAD_DIRECTORY, { recursive: true, mode: 0o700 });
  await access(UPLOAD_DIRECTORY, constants.R_OK | constants.W_OK);
}

function resolveStoredPath(storedName: string): string {
  if (!STORED_NAME_PATTERN.test(storedName)) {
    throw new StorageValidationError("Invalid stored file name.");
  }

  const filePath = path.resolve(UPLOAD_DIRECTORY, storedName);
  if (!filePath.startsWith(`${UPLOAD_DIRECTORY}${path.sep}`)) {
    throw new StorageValidationError("Invalid stored file path.");
  }

  return filePath;
}

export function getStoredFileMimeType(storedName: string): string {
  resolveStoredPath(storedName);
  const mimeType = MIME_BY_EXTENSION[path.extname(storedName).toLowerCase()];
  if (!mimeType) {
    throw new StorageValidationError("Invalid stored file type.");
  }
  return mimeType;
}

/** Validates and stores an upload under a generated, traversal-safe name. */
export async function saveUpload(input: SaveUploadInput): Promise<StoredUpload> {
  const originalName = safeOriginalName(input.originalName);
  const { extension, mimeType } = validateUpload(originalName, input.mimeType, input.data);
  const storedName = `${randomUUID()}${extension}`;
  const filePath = resolveStoredPath(storedName);

  await ensureUploadDirectory();
  const handle = await open(filePath, "wx", 0o600);
  try {
    await handle.writeFile(input.data);
    await handle.close();
  } catch (error) {
    await handle.close().catch(() => undefined);
    await unlink(filePath).catch(() => undefined);
    throw error;
  }

  return {
    storedName,
    originalName,
    mimeType,
    sizeBytes: input.data.byteLength,
    storagePath: path.posix.join("storage", "uploads", storedName),
  };
}

/** Reads a file by its generated stored name, rejecting links and non-file entries. */
export async function readStoredFile(storedName: string): Promise<Buffer> {
  const filePath = resolveStoredPath(storedName);
  const info = await lstat(filePath);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new StorageValidationError("Stored path is not a regular file.");
  }

  return readFileFromDisk(filePath);
}

/** Lists regular files saved by this helper, with basic filesystem metadata. */
export async function listStoredFiles(): Promise<StoredFileInfo[]> {
  await ensureUploadDirectory();
  const entries = await readdir(UPLOAD_DIRECTORY, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && STORED_NAME_PATTERN.test(entry.name))
      .map(async (entry): Promise<StoredFileInfo> => {
        const info = await lstat(path.join(UPLOAD_DIRECTORY, entry.name));
        return {
          storedName: entry.name,
          sizeBytes: info.size,
          modifiedAt: info.mtime,
        };
      }),
  );

  return files.sort((left, right) => left.storedName.localeCompare(right.storedName));
}

/** Deletes a stored file. Returns false when the file does not exist. */
export async function deleteStoredFile(storedName: string): Promise<boolean> {
  const filePath = resolveStoredPath(storedName);
  try {
    await unlink(filePath);
    return true;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
