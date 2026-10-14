import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
