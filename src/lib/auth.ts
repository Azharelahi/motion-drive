import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

const SESSION_COOKIE = "md_session";
const SESSION_MAX_AGE = 60 * 60 * 8;

export function createSessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`;
}

export function clearSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=0`;
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function getAdminIdFromSession(token: string): Promise<string | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;

  const admin = await prisma.admin.findFirst({
    where: {
      sessionToken: hashSessionToken(token),
      sessionExpiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  return admin?.id ?? null;
}

export async function setSessionToken(adminId: string, token: string): Promise<void> {
  await prisma.admin.update({
    where: { id: adminId },
    data: {
      sessionToken: hashSessionToken(token),
      sessionExpiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000),
    },
  });
}

export async function clearSessionToken(adminId: string): Promise<void> {
  await prisma.admin.update({
    where: { id: adminId },
    data: { sessionToken: null, sessionExpiresAt: null },
  });
}

export async function authenticateAdmin(
  username: string,
  password: string,
): Promise<{ id: string } | null> {
  const admin = await prisma.admin.findUnique({
    where: { username },
    select: { id: true, passwordHash: true },
  });
  if (!admin || !(await verifyPassword(password, admin.passwordHash))) return null;
  return { id: admin.id };
}

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

export function checkLoginRateLimit(ip: string): { allowed: boolean; remainingSeconds: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record || now - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return { allowed: true, remainingSeconds: 0 };
  }
  if (record.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    const remainingSeconds = Math.ceil((record.firstAttempt + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { allowed: false, remainingSeconds: Math.max(remainingSeconds, 0) };
  }

  record.count += 1;
  return { allowed: true, remainingSeconds: 0 };
}

export function clearLoginRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}
