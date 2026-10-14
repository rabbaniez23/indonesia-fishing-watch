/**
 * Membuat Admin pertama dari env (ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME).
 * Idempoten: tidak melakukan apa-apa bila sudah ada Admin.
 *   npm run seed:admin
 */
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

async function main() {
  const { getDb } = await import("@/lib/db");
  const { AuthError, createUser } = await import("@/lib/auth/service");

  const existing = getDb().prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get() as { n: number };
  if (existing.n > 0) {
    console.log(`Sudah ada ${existing.n} Admin. Tidak ada perubahan.`);
    return;
  }

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Admin";
  if (!email || !password) {
    console.error("ADMIN_EMAIL dan ADMIN_PASSWORD wajib diisi di .env.local.");
    process.exitCode = 1;
    return;
  }

  try {
    const user = await createUser({ email, name, role: "admin", password });
    console.log(`Admin dibuat: ${user.email}`);
    console.log("Hapus ADMIN_PASSWORD dari .env.local setelah berhasil masuk.");
  } catch (error) {
    if (error instanceof AuthError) {
      console.error(`Gagal: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

void main();
