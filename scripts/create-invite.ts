/**
 * Membuat tautan undangan dari CLI (alternatif halaman Pengaturan).
 *   npm run invite -- nama@contoh.id user
 * Peran: user | admin. Tautan dicetak sekali; token mentah tidak disimpan.
 */
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

async function main() {
  const { getDb } = await import("@/lib/db");
  const { AuthError, createInvite } = await import("@/lib/auth/service");
  const { isRole } = await import("@/lib/auth/roles");

  const [email, role = "user"] = process.argv.slice(2);
  if (!email || !isRole(role)) {
    console.error("Pemakaian: npm run invite -- <email> <user|admin>");
    process.exitCode = 1;
    return;
  }
  const admin = getDb().prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1").get() as
    | { id: string }
    | undefined;
  if (!admin) {
    console.error("Belum ada Admin. Jalankan `npm run seed:admin` terlebih dahulu.");
    process.exitCode = 1;
    return;
  }
  try {
    const { token, invite } = createInvite({ email, role, invitedBy: admin.id });
    const base = process.env.APP_BASE_URL || "http://localhost:3000";
    console.log(`Undangan ${invite.email} (${invite.role}) berlaku sampai ${invite.expiresAt}`);
    console.log(`${base}/invite/${token}`);
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
