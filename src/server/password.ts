import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// scrypt with an OWASP-recommended parameter set (N=2^16, r=8, p=2, about 64 MiB).
// Format: scrypt$N$r$p$salt$hash (base64). Parameters are stored, so they can be raised later.
const N = 2 ** 16;
const R = 8;
const P = 2;
const KEY_LENGTH = 64;
const OPTIONS: ScryptOptions = { N, r: R, p: P, maxmem: 256 * 1024 * 1024 };

function derive(
  password: string,
  salt: Buffer,
  options: ScryptOptions,
  length: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, length, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, OPTIONS, KEY_LENGTH);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

/** Constant-time check. Returns false for malformed hashes instead of throwing. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !n || !r || !p || !salt || !hash) return false;
  try {
    const expected = Buffer.from(hash, "base64");
    const key = await derive(
      password,
      Buffer.from(salt, "base64"),
      { N: Number(n), r: Number(r), p: Number(p), maxmem: 256 * 1024 * 1024 },
      expected.length,
    );
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/** Burns the same time as a real check, so unknown emails are not distinguishable by response time. */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword("not-a-real-password");
  await verifyPassword(password, await dummyHash);
  return false;
}
