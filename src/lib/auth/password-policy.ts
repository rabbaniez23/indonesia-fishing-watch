/** Kebijakan kata sandi; aman diimpor dari client component (tanpa node:crypto). */
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 256;

/** Mengembalikan pesan error berbahasa Indonesia, atau null bila valid. */
export function validateNewPassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`;
  if (password.length > MAX_PASSWORD_LENGTH) return `Kata sandi maksimal ${MAX_PASSWORD_LENGTH} karakter.`;
  return null;
}
