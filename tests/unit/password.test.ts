import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("admin password hashing", () => {
  it("verifies the correct password without storing it in plaintext", async () => {
    const password = "a-strong-admin-passphrase";
    const storedHash = await hashPassword(password);

    expect(storedHash).not.toBe(password);
    expect(storedHash.startsWith("scrypt$")).toBe(true);
    await expect(verifyPassword(password, storedHash)).resolves.toBe(true);
    await expect(verifyPassword("incorrect-password", storedHash)).resolves.toBe(false);
  });

  it("rejects malformed stored hashes", async () => {
    await expect(verifyPassword("password", "not-a-valid-hash")).resolves.toBe(false);
  });
});
