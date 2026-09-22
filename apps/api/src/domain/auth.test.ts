import { describe, expect, it } from "vitest";
import { ClinicResolutionError, resolveClinicSlug } from "./auth";

describe("resolveClinicSlug", () => {
  it("so'rovdagi clinic ustuvor", () => {
    expect(resolveClinicSlug({ inputClinic: "Klinika1", defaultClinicSlug: "boshqa" })).toBe("klinika1");
  });

  it("so'rovda yo'q bo'lsa — DEFAULT_CLINIC_SLUG ishlatiladi", () => {
    expect(resolveClinicSlug({ defaultClinicSlug: "namuna-klinika" })).toBe("namuna-klinika");
  });

  it("bo'sh satr clinic — env'ga tushadi (bo'sh emas deb hisoblanmaydi)", () => {
    expect(resolveClinicSlug({ inputClinic: "   ", defaultClinicSlug: "namuna-klinika" })).toBe("namuna-klinika");
  });

  it("ikkalasi ham yo'q — xato", () => {
    expect(() => resolveClinicSlug({})).toThrow(ClinicResolutionError);
  });

  it("ikkalasi ham bo'sh satr — xato", () => {
    expect(() => resolveClinicSlug({ inputClinic: "", defaultClinicSlug: "" })).toThrow(ClinicResolutionError);
  });

  it("natija har doim normalizatsiya qilingan (trim + lowercase)", () => {
    expect(resolveClinicSlug({ inputClinic: "  Demo-Klinika  " })).toBe("demo-klinika");
  });
});
