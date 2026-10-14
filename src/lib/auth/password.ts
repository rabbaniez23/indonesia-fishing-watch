import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Hash password memakai scrypt bawaan Node.
 * Format tersimpan: scrypt$N$r$p$<salt base64url>$<hash base64url>
 */
const PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;

function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, { ...PARAMS, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltText, hashText] = parts;
  const expected = Buffer.from(hashText, "base64url");
  const key = await scrypt(password.normalize("NFKC"), Buffer.from(saltText, "base64url"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}
