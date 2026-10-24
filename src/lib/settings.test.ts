import { beforeEach, describe, expect, it } from "vitest";
import { openDatabase, setDbForTesting } from "@/lib/db";
import { createSession, createUser, updateUserAccess, validateSession } from "@/lib/auth/service";
import { dailyBudget } from "@/lib/gfw/http";
import { setDailyBudget } from "./settings";

const PW = "kata-sandi-panjang-1";
let admin: string;
let analyst: string;

beforeEach(async () => {
  setDbForTesting(openDatabase(":memory:"));
  delete process.env.GFW_DAILY_BUDGET;
  admin = (await createUser({ email: "admin@uji.local", name: "Admin", role: "admin", password: PW })).id;
  analyst = (await createUser({ email: "a@uji.local", name: "Analis", role: "user", password: PW })).id;
});

describe("pengelolaan pengguna", () => {
  it("Admin mengubah peran pengguna lain", () => {
    expect(updateUserAccess(admin, analyst, { role: "admin" }).role).toBe("admin");
  });

  it("tidak dapat mengubah diri sendiri; Admin aktif terakhir dilindungi", async () => {
    expect(() => updateUserAccess(admin, admin, { role: "user" })).toThrow(/akun sendiri/);
    const admin2 = (await createUser({ email: "admin2@uji.local", name: "Admin 2", role: "admin", password: PW })).id;
    updateUserAccess(admin2, admin, { role: "user" }); // masih ada admin2
    expect(() => updateUserAccess(admin, admin2, { status: "disabled" })).toThrow(/minimal satu Admin aktif/);
  });

  it("menonaktifkan pengguna mencabut sesinya seketika", () => {
    const { token } = createSession(analyst);
    expect(validateSession(token)?.id).toBe(analyst);
    updateUserAccess(admin, analyst, { status: "disabled" });
    expect(validateSession(token)).toBeNull();
  });
});

describe("budget harian", () => {
  it("default 5.000; pengaturan Admin diutamakan; batas divalidasi", () => {
    expect(dailyBudget()).toBe(5000);
    setDailyBudget(1200, admin);
    expect(dailyBudget()).toBe(1200);
    expect(() => setDailyBudget(10, admin)).toThrow();
    expect(() => setDailyBudget(60000, admin)).toThrow();
  });
});
