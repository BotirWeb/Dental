import { describe, expect, it } from "vitest";
import { resolveClinicFeatures } from "./clinicFeatures";

describe("resolveClinicFeatures — yangi modul default o'chiq", () => {
  it("bo'sh obyekt -> hammasi o'chiq", () => {
    expect(resolveClinicFeatures({})).toEqual({ odontogram: false });
  });

  it("aniq true -> yoqilgan", () => {
    expect(resolveClinicFeatures({ odontogram: true })).toEqual({ odontogram: true });
  });

  it.each([["true"], [1], [null], ["yes"]])("true bo'lmagan qiymat (%s) -> o'chiq", (value) => {
    expect(resolveClinicFeatures({ odontogram: value })).toEqual({ odontogram: false });
  });

  it.each([[null], [undefined], ["{}"], [[]], [42]])("kutilmagan jsonb shakli (%s) xato tashlamaydi -> o'chiq", (raw) => {
    expect(resolveClinicFeatures(raw)).toEqual({ odontogram: false });
  });

  it("noma'lum kalitlar frontendga chiqmaydi", () => {
    expect(resolveClinicFeatures({ odontogram: true, secretBeta: true })).toEqual({ odontogram: true });
  });
});
