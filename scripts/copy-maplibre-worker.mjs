// Salin worker MapLibre GL (ESM, mandiri) ke public/vendor agar dapat dimuat lewat setWorkerUrl.
// MapLibre 6 secara default mencari worker di sebelah file bundle-nya; setelah dibundel Next.js file itu tidak ada.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const pkg = JSON.parse(readFileSync(path.join(root, "node_modules", "maplibre-gl", "package.json"), "utf8"));
const source = path.join(root, "node_modules", "maplibre-gl", "dist", "maplibre-gl-worker.mjs");
const targetDir = path.join(root, "public", "vendor");
mkdirSync(targetDir, { recursive: true });
const target = path.join(targetDir, `maplibre-gl-worker-${pkg.version}.mjs`);
copyFileSync(source, target);
console.log(`maplibre worker → ${path.relative(root, target)}`);
