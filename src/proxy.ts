import { NextResponse, type NextRequest } from "next/server";

/**
 * Pemeriksaan optimistis: halaman aplikasi tanpa cookie sesi diarahkan ke /login.
 * Ini BUKAN otorisasi — sesi & peran tetap diverifikasi di server pada layout,
 * halaman, Server Action, dan Route Handler (dokumentasi Next.js: Proxy).
 */
const SESSION_COOKIE = "ifw_session";
const PUBLIC_PREFIXES = ["/login", "/invite"];

/** Landing page publik di "/" hanya tampil bila LANDING_PAGE=on di .env.local server; bawaan: nonaktif. */
function landingEnabled(): boolean {
  return process.env.LANDING_PAGE === "on";
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // Landing nonaktif: "/" langsung ke halaman login (atau Ringkasan bila sudah masuk).
  if (pathname === "/" && !landingEnabled()) {
    return NextResponse.redirect(new URL(request.cookies.has(SESSION_COOKIE) ? "/overview" : "/login", request.url));
  }
  if (pathname === "/" || PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.next();
  }
  if (!request.cookies.has(SESSION_COOKIE)) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // API menangani autentikasinya sendiri (JSON 401/403), aset statis dilewati.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$).*)"],
};
