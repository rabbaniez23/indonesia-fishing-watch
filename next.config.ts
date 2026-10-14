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
