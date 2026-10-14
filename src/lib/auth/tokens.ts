import { createHash, randomBytes } from "node:crypto";

/** Token acak untuk cookie sesi / tautan undangan. Hanya hash-nya yang disimpan di database. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
