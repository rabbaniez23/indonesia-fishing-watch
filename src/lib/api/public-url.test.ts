import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { publicOrigin } from "./public-url";

describe("publicOrigin", () => {
  afterEach(() => vi.unstubAllEnvs());
  const req = new NextRequest("https://localhost:3000/api/admin/invites", { method: "POST" });

  it("memakai APP_BASE_URL di balik tunnel", () => {
    vi.stubEnv("APP_BASE_URL", "https://indonesiafishingwatch.my.id/");
    expect(publicOrigin(req)).toBe("https://indonesiafishingwatch.my.id");
  });
  it("tanpa APP_BASE_URL atau bila rusak → origin request", () => {
    vi.stubEnv("APP_BASE_URL", "");
    expect(publicOrigin(req)).toBe("https://localhost:3000");
    vi.stubEnv("APP_BASE_URL", "bukan url");
    expect(publicOrigin(req)).toBe("https://localhost:3000");
  });
});
