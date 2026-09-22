import { describe, expect, it } from "vitest";
import { validatePassword } from "./password";

describe("validatePassword", () => {
  it("yetarlicha uzun, oddiy bo'lmagan parol — yaroqli", () => {
    expect(validatePassword({ password: "meningKuchliParolim", login: "owner" })).toBeNull();
  });

  it("10 belgidan kam — rad etiladi", () => {
    expect(validatePassword({ password: "qisqa123", login: "owner" })).not.toBeNull();
  });

  it("aynan 10 belgi — yaroqli (chegara)", () => {
    expect(validatePassword({ password: "abcdefghij", login: "owner" })).toBeNull();
  });

  it("login bilan bir xil — rad etiladi (katta/kichik harfdan qat'i nazar)", () => {
    expect(validatePassword({ password: "OwnerLogin", login: "ownerlogin" })).not.toBeNull();
  });

  it("klinika kodi bilan bir xil — rad etiladi", () => {
    expect(validatePassword({ password: "namuna-klinika", login: "owner", clinicSlug: "namuna-klinika" })).not.toBeNull();
  });

  it("taqiq ro'yxatidagi parol — rad etiladi", () => {
    expect(validatePassword({ password: "qwerty123", login: "owner" })).not.toBeNull();
  });

  it("taqiq ro'yxati katta/kichik harfga sezgir emas", () => {
    expect(validatePassword({ password: "QWERTY123", login: "owner" })).not.toBeNull();
  });

  it("katta harf yoki maxsus belgi talab qilinmaydi", () => {
    expect(validatePassword({ password: "oddiylekinuzunparol", login: "owner" })).toBeNull();
  });
});
