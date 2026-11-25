import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getStoredFileMimeType,
  listStoredFiles,
  readStoredFile,
} from "@/lib/storage";
import { requireAdmin } from "@/lib/route-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function melbourneDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const [vehicles, drivers, contracts, vehicleSwaps, documents] =
      await prisma.$transaction([
        prisma.vehicle.findMany(),
        prisma.driver.findMany(),
        prisma.contract.findMany(),
        prisma.vehicleSwap.findMany(),
        prisma.document.findMany(),
      ]);
    const storedFiles = await listStoredFiles();
    const documentsByStoredName = new Map(
      documents.map((document) => [document.storedName, document]),
    );
    const files = await Promise.all(
      storedFiles.map(async (file) => {
        const linkedDocument = documentsByStoredName.get(file.storedName);
        const data = await readStoredFile(file.storedName);
        return {
          storedName: file.storedName,
          originalName: linkedDocument?.originalName ?? file.storedName,
          mimeType: linkedDocument?.mimeType ?? getStoredFileMimeType(file.storedName),
          sizeBytes: file.sizeBytes,
          modifiedAt: file.modifiedAt.toISOString(),
          dataBase64: data.toString("base64"),
        };
      }),
    );
    const backup = {
      format: "MotionDrive_Backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      records: {
        vehicles,
        drivers,
        contracts,
        vehicleSwaps,
        documents: documents.map((document) => ({
          ...document,
          sizeBytes: document.sizeBytes.toString(),
        })),
      },
      files,
    };
    const date = melbourneDate();

    return new Response(JSON.stringify(backup), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="MotionDrive_Backup_${date}.json"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Motion Drive backup export failed", error);
    return NextResponse.json(
      { error: "Backup export failed. Check the server logs for details." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
