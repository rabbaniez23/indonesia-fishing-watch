import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readZip } from "./zip";

describe("readZip", () => {
  it.runIf(process.platform === "win32")("membaca zip deflate buatan sistem", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "zip-test-"));
    const json = JSON.stringify({ entries: Array.from({ length: 200 }, (_, i) => ({ i, hours: i / 10 })) });
    writeFileSync(path.join(dir, "data.json"), json);
    writeFileSync(path.join(dir, "README.txt"), "caveat");
    const zipPath = path.join(dir, "out.zip");
    execFileSync("powershell", [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${path.join(dir, "data.json")}','${path.join(dir, "README.txt")}' -DestinationPath '${zipPath}'`,
    ]);
    const files = readZip(readFileSync(zipPath));
    expect(files.get("data.json")?.toString("utf8")).toBe(json);
    expect(files.get("README.txt")?.toString("utf8")).toBe("caveat");
  }, 30000);

  it("menolak data yang bukan zip", () => {
    expect(() => readZip(new Uint8Array(100))).toThrow(/tidak valid/);
  });
});
