import { describe, expect, it } from "vitest";
import { DiscountError, computeDiscountAmount, lineTotal, validateDiscount } from "./discount";

describe("lineTotal", () => {
  it("satr jamisi = narx * soni", () => {
    expect(lineTotal(620_000, 3)).toBe(1_860_000);
  });
});

describe("computeDiscountAmount — so'm", () => {
  it("so'm chegirma o'zgarishsiz qaytadi", () => {
    expect(computeDiscountAmount({ type: "amount", value: 50_000 }, 620_000)).toBe(50_000);
  });

  it("chegirmasiz 0", () => {
    expect(computeDiscountAmount({ type: "amount", value: 0 }, 620_000)).toBe(0);
  });

  it("to'liq chegirma (summaga teng) ruxsat etiladi", () => {
    expect(computeDiscountAmount({ type: "amount", value: 620_000 }, 620_000)).toBe(620_000);
  });
});

describe("computeDiscountAmount — foiz", () => {
  it("10% to'g'ri hisoblanadi", () => {
    expect(computeDiscountAmount({ type: "percent", value: 10 }, 620_000)).toBe(62_000);
  });

  it("kasrli foiz so'mga yaxlitlanadi", () => {
    // 620 000 ning 12.5% = 77 500
    expect(computeDiscountAmount({ type: "percent", value: 12.5 }, 620_000)).toBe(77_500);
  });

  it("100% butun summani beradi", () => {
    expect(computeDiscountAmount({ type: "percent", value: 100 }, 620_000)).toBe(620_000);
  });
});

describe("computeDiscountAmount — XATOLAR (jimgina yutilmaydi)", () => {
  it("summadan katta so'm chegirmasi rad etiladi", () => {
    // AVVAL: Math.max(gross, 0) buni jimgina 0 ga aylantirardi.
    expect(() => computeDiscountAmount({ type: "amount", value: 700_000 }, 620_000)).toThrow(
      DiscountError,
    );
  });

  it("100 dan katta foiz rad etiladi", () => {
    expect(() => computeDiscountAmount({ type: "percent", value: 150 }, 620_000)).toThrow(
      DiscountError,
    );
  });

  it("manfiy chegirma rad etiladi", () => {
    expect(() => computeDiscountAmount({ type: "amount", value: -1 }, 620_000)).toThrow(
      DiscountError,
    );
  });

  it("NaN rad etiladi", () => {
    expect(() => computeDiscountAmount({ type: "amount", value: Number.NaN }, 620_000)).toThrow(
      DiscountError,
    );
  });
});

describe("validateDiscount", () => {
  it("to'g'ri chegirmada null", () => {
    expect(validateDiscount({ type: "percent", value: 10 }, 620_000)).toBeNull();
  });

  it("xato bo'lsa matn qaytaradi", () => {
    const msg = validateDiscount({ type: "amount", value: 999_999 }, 620_000);
    expect(msg).toContain("katta bo'lishi mumkin emas");
  });
});
