import { existsSync } from "node:fs";

/** Muat .env.local untuk skrip CLI (Next.js memuatnya sendiri saat dev/build). */
export function loadLocalEnv(): void {
  for (const file of [".env.local", ".env"]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}
