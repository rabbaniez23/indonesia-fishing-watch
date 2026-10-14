import { beforeEach, describe, expect, it } from "vitest";
import { getDb, openDatabase, setDbForTesting } from "@/lib/db";
import { createUser } from "@/lib/auth/service";
import { addNote, createFinding, FindingError, getFinding, listFindings, updateFinding } from "./service";

let analyst: string;
let other: string;

const base = {
  title: "Aktivitas tinggi di sel Selat Makassar",
  reason: "Jam apparent fishing tertinggi pada periode ini; perlu ditinjau bersama data lapangan.",
  priority: "sedang" as const,
  priorityReason: "Nilai sel di kelas tertinggi.",
  source: {
    type: "cell" as const,
    resultId: "r1",
    layer: "fishingEffort" as const,
    lat: -3.7,
    lon: 114.5,
    value: 707,
    unit: "jam",
    datasetResolved: "public-global-fishing-effort:v4.0",
    fetchedAt: "2026-10-13T08:00:00Z",
  },
  filter: { regionId: "", from: "2026-09-08", to: "2026-10-07" },
};

beforeEach(async () => {
  setDbForTesting(openDatabase(":memory:"));
  analyst = (await createUser({ email: "a@uji.local", name: "Analis", role: "analyst", password: "kata-sandi-panjang-1" })).id;
  other = (await createUser({ email: "b@uji.local", name: "Analis Lain", role: "analyst", password: "kata-sandi-panjang-1" })).id;
});

describe("temuan", () => {
  it("dibuat dengan status baru, snapshot sumber tersimpan, catatan 'dibuat' & audit", () => {
    const f = createFinding(base, analyst);
    expect(f).toMatchObject({ status: "baru", priority: "sedang", version: 1, sourceType: "cell" });
    expect(f.source).toMatchObject({ value: 707, datasetResolved: "public-global-fishing-effort:v4.0" });
    expect(f.notes.map((n) => n.kind)).toEqual(["dibuat"]);
    const audit = getDb().prepare("SELECT action FROM audit_entries WHERE entity_id = ?").all(f.id) as Array<{ action: string }>;
    expect(audit.map((a) => a.action)).toContain("finding.create");
    expect(listFindings()).toHaveLength(1);
  });

  it("validasi input: judul, alasan, alasan prioritas wajib", () => {
    expect(() => createFinding({ ...base, title: "ab" }, analyst)).toThrow();
    expect(() => createFinding({ ...base, reason: "pendek" }, analyst)).toThrow();
    expect(() => createFinding({ ...base, priorityReason: "" }, analyst)).toThrow();
  });

  it("transisi status mengikuti alur; lompatan tidak sah ditolak", () => {
    const f = createFinding(base, analyst);
    expect(() => updateFinding(f.id, { version: 1, status: "selesai" }, analyst)).toThrow(/tidak dapat diubah/);
    const g = updateFinding(f.id, { version: 1, status: "ditinjau" }, analyst);
    expect(g).toMatchObject({ status: "ditinjau", version: 2 });
    const h = updateFinding(f.id, { version: 2, status: "selesai" }, analyst);
    expect(h.status).toBe("selesai");
  });

  it("buka kembali temuan selesai wajib dengan alasan", () => {
    const f = createFinding(base, analyst);
    updateFinding(f.id, { version: 1, status: "ditinjau" }, analyst);
    updateFinding(f.id, { version: 2, status: "selesai" }, analyst);
    expect(() => updateFinding(f.id, { version: 3, status: "ditinjau" }, analyst)).toThrow(/Alasan wajib/);
    const r = updateFinding(f.id, { version: 3, status: "ditinjau", statusReason: "Ada data baru dari lapangan." }, analyst);
    expect(r.status).toBe("ditinjau");
    expect(r.notes.at(-1)).toMatchObject({ kind: "status", fromValue: "selesai", toValue: "ditinjau", body: "Ada data baru dari lapangan." });
  });

  it("version guard: perubahan dengan versi lama ditolak (CONFLICT)", () => {
    const f = createFinding(base, analyst);
    updateFinding(f.id, { version: 1, status: "ditinjau" }, analyst);
    try {
      updateFinding(f.id, { version: 1, priority: "tinggi", priorityReason: "Bertambah penting." }, other);
      throw new Error("seharusnya gagal");
    } catch (e) {
      expect(e).toBeInstanceOf(FindingError);
      expect((e as FindingError).code).toBe("CONFLICT");
    }
  });

  it("ubah prioritas wajib alasan dan tercatat di riwayat", () => {
    const f = createFinding(base, analyst);
    expect(() => updateFinding(f.id, { version: 1, priority: "tinggi" }, analyst)).toThrow(/Alasan perubahan prioritas/);
    const g = updateFinding(f.id, { version: 1, priority: "tinggi", priorityReason: "Terulang pada dua periode." }, other);
    expect(g).toMatchObject({ priority: "tinggi", priorityReason: "Terulang pada dua periode.", updatedBy: { id: other } });
    expect(g.notes.at(-1)).toMatchObject({ kind: "prioritas", fromValue: "sedang", toValue: "tinggi" });
  });

  it("catatan append-only: tidak dapat diubah atau dihapus di database", () => {
    const f = addNote(createFinding(base, analyst).id, { body: "Catatan pertama." }, analyst);
    const note = f.notes.at(-1)!;
    expect(note).toMatchObject({ kind: "catatan", body: "Catatan pertama.", actor: { name: "Analis" } });
    expect(() => getDb().prepare("UPDATE finding_notes SET body = 'ubah' WHERE id = ?").run(note.id)).toThrow(/append-only/);
    expect(() => getDb().prepare("DELETE FROM finding_notes WHERE id = ?").run(note.id)).toThrow(/append-only/);
    expect(getFinding(f.id)!.notes).toHaveLength(2);
  });

  it("snapshot sumber tidak berubah oleh perubahan status", () => {
    const f = createFinding(base, analyst);
    const g = updateFinding(f.id, { version: 1, status: "ditinjau" }, analyst);
    expect(g.source).toEqual(f.source);
    expect(g.filter).toEqual(f.filter);
  });
});
