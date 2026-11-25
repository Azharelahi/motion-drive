import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst, sessionCookie } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  sessionCookie: { value: null as string | null },
}));

vi.mock("@/lib/db", () => ({
  prisma: { admin: { findFirst } },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === "md_session" && sessionCookie.value
        ? { value: sessionCookie.value }
        : undefined,
  })),
}));

import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { createSessionCookie, hashSessionToken } from "@/lib/auth";
import { requireAdmin } from "@/lib/route-auth";

const validToken = "a".repeat(64);

describe("admin route protection", () => {
  beforeEach(() => {
    findFirst.mockReset();
    sessionCookie.value = null;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows sign-in routes without a session", async () => {
    const loginPage = await proxy(new NextRequest("https://motion-drive.test/login"));
    const loginEndpoint = await proxy(
      new NextRequest("https://motion-drive.test/api/auth/login", {
        method: "POST",
        headers: { origin: "https://motion-drive.test" },
      }),
    );

    expect(loginPage.headers.get("x-middleware-next")).toBe("1");
    expect(loginEndpoint.headers.get("x-middleware-next")).toBe("1");
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated pages and rejects unauthenticated APIs", async () => {
    const page = await proxy(new NextRequest("https://motion-drive.test/vehicles"));
    const api = await proxy(new NextRequest("https://motion-drive.test/api/vehicles"));

    expect(page.headers.get("location")).toContain("/login");
    expect(api.status).toBe(401);
    expect(await api.json()).toEqual({ error: "Authentication required." });
  });

  it("rejects cross-origin state-changing requests", async () => {
    const response = await proxy(
      new NextRequest("https://motion-drive.test/api/vehicles", {
        method: "POST",
        headers: { origin: "https://attacker.test" },
      }),
    );

    expect(response.status).toBe(403);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("validates the database session and its expiry inside Route Handlers", async () => {
    sessionCookie.value = validToken;
    findFirst.mockResolvedValue(null);

    const expired = await requireAdmin();
    expect(expired?.status).toBe(401);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sessionToken: hashSessionToken(validToken),
          sessionExpiresAt: { gt: expect.any(Date) },
        }),
      }),
    );

    findFirst.mockResolvedValue({ id: "admin-1" });
    expect(await requireAdmin()).toBeNull();
  });

  it("issues persistent eight-hour HttpOnly cookies with production transport security", () => {
    vi.stubEnv("NODE_ENV", "production");
    const cookie = createSessionCookie(validToken);

    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=28800");
  });
});
