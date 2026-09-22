import { describe, expect, it } from "vitest";
import { type ChargeRow, calculatePatientBalance, chargeOf } from "./patientBalance";
import type { PaymentRow } from "./payments";

const charge = (over: Partial<ChargeRow> = {}): ChargeRow => ({
  priceSnapshot: 620_000,
  qty: 1,
  discountAmount: 0,
  isWarranty: false,
  ...over,
});

const pay = (id: string, amount: number, over: Partial<PaymentRow> = {}): PaymentRow => ({
  id,
  amount,
  method: "cash",
  ...over,
});

describe("chargeOf", () => {
  it("chegirma ayiriladi", () => {
    expect(chargeOf(charge({ discountAmount: 20_000 }))).toBe(600_000);
  });

  it("kafolat bo'yicha ish 0 — tushum yo'q", () => {
    expect(chargeOf(charge({ isWarranty: true }))).toBe(0);
  });

  it("o'chirilgan satr 0", () => {
    expect(chargeOf(charge({ deletedAt: new Date() }))).toBe(0);
  });

  it("soni hisobga olinadi", () => {
    expect(chargeOf(charge({ qty: 3 }))).toBe(1_860_000);
  });
});

describe("calculatePatientBalance", () => {
  it("to'liq to'langan — balans nol", () => {
    const r = calculatePatientBalance([charge()], [pay("1", 620_000)]);
    expect(r.balance).toBe(0);
    expect(r.debt).toBe(0);
    expect(r.advance).toBe(0);
  });

  it("qisman to'langan — qarz", () => {
    const r = calculatePatientBalance([charge()], [pay("1", 400_000)]);
    expect(r.debt).toBe(220_000);
    expect(r.advance).toBe(0);
  });

  it("ortiqcha to'langan — avans", () => {
    const r = calculatePatientBalance([charge()], [pay("1", 800_000)]);
    expect(r.advance).toBe(180_000);
    expect(r.debt).toBe(0);
  });

  it("avans, xizmatdan oldin to'langan", () => {
    const r = calculatePatientBalance([], [pay("1", 1_000_000)]);
    expect(r.advance).toBe(1_000_000);
  });

  it("bekor qilingan to'lov qarzni qaytaradi", () => {
    const r = calculatePatientBalance(
      [charge()],
      [
        pay("1", 620_000, { voidedAt: new Date() }),
        pay("2", -620_000, { reversalOfId: "1" }),
      ],
    );
    expect(r.debt).toBe(620_000);
  });

  it("kafolat ishi qarz yaratmaydi", () => {
    const r = calculatePatientBalance([charge({ isWarranty: true })], []);
    expect(r.charged).toBe(0);
    expect(r.debt).toBe(0);
  });

  it("chegirma va bir nechta xizmat birga", () => {
    const r = calculatePatientBalance(
      [
        charge({ priceSnapshot: 620_000, discountAmount: 62_000 }),
        charge({ priceSnapshot: 1_200_000, qty: 2, discountAmount: 200_000 }),
      ],
      [pay("1", 1_000_000)],
    );
    // 558 000 + 2 200 000 = 2 758 000 hisoblandi, 1 000 000 to'landi
    expect(r.charged).toBe(2_758_000);
    expect(r.debt).toBe(1_758_000);
  });
});
