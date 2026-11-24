import { randomUUID } from "node:crypto";
import { access, mkdir, open, rm } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const uploadsDirectory = path.join(process.cwd(), "storage", "uploads");

async function checkStorage(): Promise<boolean> {
  await mkdir(uploadsDirectory, { recursive: true });
  await access(uploadsDirectory, constants.R_OK | constants.W_OK);

  const probePath = path.join(uploadsDirectory, `.health-check-${randomUUID()}`);
  const probe = await open(probePath, "wx");

  try {
    await probe.close();
  } finally {
    await rm(probePath, { force: true });
  }

  return true;
}

export async function GET() {
  const [database, storage] = await Promise.all([
    prisma
      .$queryRaw`SELECT 1`
      .then(() => "ok" as const)
      .catch(() => "error" as const),
    checkStorage()
      .then(() => "ok" as const)
      .catch(() => "error" as const),
  ]);

  const ready = database === "ok" && storage === "ok";

  return NextResponse.json(
    { status: ready ? "ok" : "error", checks: { database, storage } },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
