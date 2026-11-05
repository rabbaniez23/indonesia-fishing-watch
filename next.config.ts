import type { NextConfig } from "next";

/** Host publik (tunnel/domain) yang boleh memanggil Server Action login; diambil dari APP_BASE_URL. */
function publicHost(): string[] {
  try {
    return process.env.APP_BASE_URL ? [new URL(process.env.APP_BASE_URL).host] : [];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  experimental: { serverActions: { allowedOrigins: publicHost() } },
  // Indikator dev dipindah agar tidak menutupi kontrol sidebar di kiri bawah.
  devIndicators: { position: "bottom-right" },
  cacheComponents: true,
  // Halaman pengolahan data pindah ke bawah Dokumentasi; tautan lama tetap berfungsi.
  async redirects() {
    return [
      { source: "/data-status", destination: "/dokumentasi/sumber-data", permanent: true },
      { source: "/preprocessing-viirs", destination: "/dokumentasi/preprocessing-viirs", permanent: true },
    ];
  },
  // Aset landing berversi di nama foldernya (hero-v1), jadi aman di-cache selamanya oleh browser & Cloudflare.
  async headers() {
    return [{ source: "/landing/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] }];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
