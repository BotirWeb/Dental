import { describe, it, expect } from "vitest";
import { calculateRevenue, calculateDoctorEarning, calculateServiceMargin, type PerformedServiceInput } from "./doctorEarnings";

function makeService(overrides: Partial<PerformedServiceInput> = {}): PerformedServiceInput {
  return {
    priceSnapshot: 500_000,
    qty: 1,
    discountAmount: 0,
    doctorPctSnapshot: 40,
    materialCostSnapshot: 50_000,
    labCost: 0,
    isWarranty: false,
    ...overrides,
  };
}

describe("calculateRevenue", () => {
  it("narx * qty - chegirma ni qaytaradi", () => {
    expect(calculateRevenue(makeService({ priceSnapshot: 200_000, qty: 2, discountAmount: 50_000 }))).toBe(350_000);
  });

  it("chegirma narxdan katta bo'lsa 0 dan pastga tushmaydi", () => {
    expect(calculateRevenue(makeService({ priceSnapshot: 100_000, qty: 1, discountAmount: 500_000 }))).toBe(0);
  });

  it("kafolat bo'lsa tushum 0", () => {
    expect(calculateRevenue(makeService({ isWarranty: true, priceSnapshot: 500_000 }))).toBe(0);
  });
});

describe("calculateDoctorEarning — basis: gross", () => {
  it("to'liq narxdan foiz oladi (material ayirilmaydi)", () => {
    // revenue = 500_000, pct = 40% => 200_000, material_cost_snapshot e'tiborga olinmaydi
    const result = calculateDoctorEarning(makeService({ priceSnapshot: 500_000, doctorPctSnapshot: 40, materialCostSnapshot: 200_000 }), "gross");
    expect(result).toBe(200_000);
  });

  it("chegirma hisobga olingan tushumdan foiz oladi", () => {
    const result = calculateDoctorEarning(makeService({ priceSnapshot: 500_000, discountAmount: 100_000, doctorPctSnapshot: 50 }), "gross");
    // revenue = 400_000, 50% => 200_000
    expect(result).toBe(200_000);
  });
});

describe("calculateDoctorEarning — basis: after_material", () => {
  it("material ayirilgandan keyingi summadan foiz oladi", () => {
    // revenue = 500_000, material = 200_000 => baza 300_000, 40% => 120_000
    const result = calculateDoctorEarning(makeService({ priceSnapshot: 500_000, materialCostSnapshot: 200_000, doctorPctSnapshot: 40 }), "after_material");
    expect(result).toBe(120_000);
  });

  it("material tushumdan katta bo'lsa baza 0 dan pastga tushmaydi", () => {
    const result = calculateDoctorEarning(makeService({ priceSnapshot: 100_000, materialCostSnapshot: 900_000, doctorPctSnapshot: 40 }), "after_material");
    expect(result).toBe(0);
  });
});

describe("calculateDoctorEarning — kafolat", () => {
  it("kafolat vizitida komissiya 0 (basis qanday bo'lishidan qat'iy nazar)", () => {
    const service = makeService({ isWarranty: true, priceSnapshot: 500_000, doctorPctSnapshot: 40 });
    expect(calculateDoctorEarning(service, "gross")).toBe(0);
    expect(calculateDoctorEarning(service, "after_material")).toBe(0);
  });
});

describe("calculateServiceMargin", () => {
  it("marja = tushum - shifokor ulushi - material - lab", () => {
    const service = makeService({
      priceSnapshot: 500_000,
      qty: 1,
      discountAmount: 0,
      doctorPctSnapshot: 40,
      materialCostSnapshot: 50_000,
      labCost: 30_000,
    });
    const result = calculateServiceMargin(service, "gross");
    // revenue 500_000, doctorEarning 200_000, material 50_000, lab 30_000
    expect(result.revenue).toBe(500_000);
    expect(result.doctorEarning).toBe(200_000);
    expect(result.margin).toBe(500_000 - 200_000 - 50_000 - 30_000);
  });

  it("kafolat vizitida marja manfiy bo'ladi (tushum yo'q, xarajat bor)", () => {
    const service = makeService({ isWarranty: true, materialCostSnapshot: 50_000, labCost: 20_000 });
    const result = calculateServiceMargin(service, "gross");
    expect(result.revenue).toBe(0);
    expect(result.doctorEarning).toBe(0);
    expect(result.margin).toBe(-70_000);
  });
});
