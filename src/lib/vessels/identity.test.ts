import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { vesselIdentitySchema } from "@/lib/gfw/schemas";
import { summarizeIdentity, typedLabel } from "./identity";

const fixture = (name: string) => JSON.parse(readFileSync(path.join(process.cwd(), "fixtures", "gfw", `${name}.json`), "utf8"));
const sampled = (v: unknown) => (Array.isArray(v) ? v : (v as { sample: unknown[] }).sample);

describe("summarizeIdentity", () => {
  it("entri dengan beberapa identitas AIS: utama = transmisi terakhir, sisanya tetap terlihat", () => {
    const body = fixture("07-vessel-search").response.body;
    const entry = vesselIdentitySchema.parse(sampled(body.entries)[0]);
    const s = summarizeIdentity(entry);
    expect(s.primary?.transmissionDateTo).toBe("2026-09-22T19:49:38Z");
    expect(s.others.length).toBe(entry.selfReportedInfo.length - 1);
    expect(s.sources).toEqual(["AIS"]);
  });

  it("ID yang diminta diutamakan bila ada di entri", () => {
    const body = fixture("07-vessel-search").response.body;
    const entry = vesselIdentitySchema.parse(sampled(body.entries)[0]);
    const requested = "95e0b0762-20ed-25af-491e-238c8ad9e52d";
    expect(summarizeIdentity(entry, requested).primary?.id).toBe(requested);
  });

  it("registry tercatat tetapi detail tidak dikembalikan → jumlah tercatat vs ditampilkan dibedakan", () => {
    const identity = vesselIdentitySchema.parse(fixture("21-vessel-by-id-registry").response.body);
    const s = summarizeIdentity(identity);
    expect(s.registryCount).toBe(1);
    expect(s.registryShown).toBe(0);
    expect(s.sources).toContain("Registry");
  });

  it("tipe dari combinedSourcesInfo milik identitas utama", () => {
    const identity = vesselIdentitySchema.parse(fixture("06-vessel-by-id").response.body);
    const s = summarizeIdentity(identity);
    expect(typedLabel(s.shiptypes)).toBe("FISHING");
    expect(typedLabel([])).toBeNull();
  });
});
