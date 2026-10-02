// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the right password and rejects wrong ones", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("uses a different salt every time", async () => {
    const [a, b] = await Promise.all([
      hashPassword("same-password-1"),
      hashPassword("same-password-1"),
    ]);
    expect(a).not.toBe(b);
  });

  it("returns false for malformed hashes instead of throwing", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$1$2$3$4$5")).toBe(false);
    expect(await verifyPassword("x", "scrypt$1$1$1$%%%$%%%")).toBe(false);
  });

  it("dummy verification always fails", async () => {
    expect(await verifyAgainstDummy("anything")).toBe(false);
  });
}, 30_000);
