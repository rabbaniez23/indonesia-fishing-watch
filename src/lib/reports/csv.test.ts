import { describe, expect, it } from "vitest";
import { readZip } from "@/lib/gfw/zip";
import { escapeCsvField, toCsv } from "./csv";
import { writeZip } from "./zip-writer";

describe("CSV", () => {
  it("mencegah formula injection pada teks, tidak mengubah angka", () => {
    expect(escapeCsvField("=HYPERLINK(\"http://x\")")).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(escapeCsvField("+62 812")).toBe("'+62 812");
    expect(escapeCsvField("-cmd")).toBe("'-cmd");
    expect(escapeCsvField("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(escapeCsvField(-3.7)).toBe("-3.7");
    expect(escapeCsvField("KM JAMAIN")).toBe("KM JAMAIN");
  });

  it("mengutip koma, kutip, dan baris baru; null/NaN kosong (bukan 0)", () => {
    expect(escapeCsvField("a,b")).toBe('"a,b"');
    expect(escapeCsvField('kata "x"')).toBe('"kata ""x"""');
    expect(escapeCsvField("baris\nbaru")).toBe('"baris\nbaru"');
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(Number.NaN)).toBe("");
  });

  it("toCsv: BOM, CRLF, angka format mesin", () => {
    const csv = toCsv(["tanggal", "jam"], [["2026-09-08", 1876.43], ["2026-09-09", null]]);
    expect(csv.startsWith("﻿tanggal,jam\r\n")).toBe(true);
    expect(csv).toContain("2026-09-08,1876.43\r\n");
    expect(csv).toContain("2026-09-09,\r\n");
  });
});

describe("writeZip", () => {
  it("menulis ZIP yang dapat dibaca kembali (round-trip)", () => {
    const data = Buffer.from(toCsv(["a"], [["ä,ö"]]), "utf8");
    const meta = Buffer.from("kunci,nilai\r\n", "utf8");
    const zip = writeZip([
      { name: "data.csv", data },
      { name: "metadata.csv", data: meta },
    ]);
    const files = readZip(zip);
    expect(files.get("data.csv")?.equals(data)).toBe(true);
    expect(files.get("metadata.csv")?.toString("utf8")).toBe("kunci,nilai\r\n");
  });
});
