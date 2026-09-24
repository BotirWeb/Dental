import { describe, expect, it } from "vitest";
import { DENTAL_CHART_MAX_BYTES, saveDentalChartSchema } from "@dental/shared";
import { decideChartSave, jsonByteLength } from "./dentalChart";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("decideChartSave — optimistik qulf", () => {
  it("birinchi karta: oldin hech narsa yo'q, mijoz ham null bilan ochgan", () => {
    expect(decideChartSave({ latestChartId: null, baseChartId: null })).toEqual({ kind: "ok" });
  });

  it("mijoz eng oxirgi versiya ustida ishlagan", () => {
    expect(decideChartSave({ latestChartId: A, baseChartId: A })).toEqual({ kind: "ok" });
  });

  it("oraliqda boshqa kishi yangi versiya saqlagan -> to'qnashuv", () => {
    expect(decideChartSave({ latestChartId: B, baseChartId: A })).toEqual({ kind: "conflict" });
  });

  it("mijoz bo'sh kartani ochgan, oraliqda kimdir birinchisini saqlagan -> to'qnashuv", () => {
    expect(decideChartSave({ latestChartId: A, baseChartId: null })).toEqual({ kind: "conflict" });
  });

  it("mijoz ochgan versiya endi yo'q (o'chirilgan) -> to'qnashuv", () => {
    expect(decideChartSave({ latestChartId: null, baseChartId: A })).toEqual({ kind: "conflict" });
  });
});

describe("jsonByteLength", () => {
  it("UTF-8 baytlarni sanaydi, belgilarni emas", () => {
    // JSON qo'shtirnoqlari (2 bayt) + "ab" (2 bayt) / "ё" (bitta belgi, lekin 2 bayt UTF-8).
    expect(jsonByteLength("ab")).toBe(4);
    expect(jsonByteLength("ё")).toBe(4);
  });

  it("chegara odatiy kartadan ancha katta", () => {
    const teeth: Record<string, unknown> = {};
    for (const q of [1, 2, 3, 4]) for (let n = 1; n <= 8; n++) teeth[`${q}${n}`] = { caries: ["M", "O"], note: "x".repeat(200) };
    expect(jsonByteLength({ version: "2.22", teeth })).toBeLessThan(DENTAL_CHART_MAX_BYTES / 10);
  });
});

describe("saveDentalChartSchema — karta qobig'i", () => {
  const validPayload = { version: "2.22", globals: { wisdomVisible: true }, teeth: { "11": { missing: false }, "48": {} } };

  it("to'g'ri karta o'tadi", () => {
    expect(saveDentalChartSchema.safeParse({ payload: validPayload, baseChartId: null }).success).toBe(true);
    expect(saveDentalChartSchema.safeParse({ payload: validPayload, baseChartId: A }).success).toBe(true);
  });

  it("kutubxonaning noma'lum yuqori maydoni jimgina o'chirilmaydi", () => {
    const parsed = saveDentalChartSchema.parse({ payload: { ...validPayload, futureField: { a: 1 } }, baseChartId: null });
    expect((parsed.payload as Record<string, unknown>).futureField).toEqual({ a: 1 });
  });

  it.each(["10", "19", "51", "85", "0", "abc", "111"])("FDI doimiy tish bo'lmagan kalit rad etiladi: %s", (key) => {
    const result = saveDentalChartSchema.safeParse({ payload: { version: "2.22", teeth: { [key]: {} } }, baseChartId: null });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toContain("FDI");
  });

  it("reja (plan) qismida ham tish raqami tekshiriladi", () => {
    const result = saveDentalChartSchema.safeParse({ payload: { ...validPayload, plan: { "99": {} } }, baseChartId: null });
    expect(result.success).toBe(false);
  });

  it("versiyasiz karta rad etiladi — o'zbekcha tushunarli xabar bilan", () => {
    const result = saveDentalChartSchema.safeParse({ payload: { teeth: {} }, baseChartId: null });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toContain("versiyasi");
  });

  it("tish holati obyekt bo'lmasa rad etiladi", () => {
    const result = saveDentalChartSchema.safeParse({ payload: { version: "2.22", teeth: { "11": "caries" } }, baseChartId: null });
    expect(result.success).toBe(false);
  });

  it("payload yo'q yoki massiv bo'lsa rad etiladi", () => {
    expect(saveDentalChartSchema.safeParse({ baseChartId: null }).success).toBe(false);
    expect(saveDentalChartSchema.safeParse({ payload: [], baseChartId: null }).success).toBe(false);
  });

  it("baseChartId majburiy (null ham qiymat) va UUID bo'lishi shart", () => {
    expect(saveDentalChartSchema.safeParse({ payload: validPayload }).success).toBe(false);
    expect(saveDentalChartSchema.safeParse({ payload: validPayload, baseChartId: "1" }).success).toBe(false);
  });
});
