import { describe, expect, it } from "vitest";
import { CashSessionError, closeCashSession } from "./cashSession";
import type { PaymentRow } from "./payments";

const cash = (id: string, amount: number, over: Partial<PaymentRow> = {}): PaymentRow => ({
  id,
  amount,
  method: "cash",
  cashSessionId: "s1",
  ...over,
});

describe("closeCashSession", () => {
  it("farq yo'q — hammasi joyida", () => {
    const r = closeCashSession({
      openingFloat: 100_000,
      payments: [cash("1", 300_000), cash("2", 200_000)],
      countedCash: 600_000,
      cashSessionId: "s1",
    });
    expect(r.expectedCash).toBe(600_000);
    expect(r.diff).toBe(0);
    expect(r.hasDiscrepancy).toBe(false);
  });

  it("naqd yetishmayapti — manfiy farq", () => {
    const r = closeCashSession({
      openingFloat: 0,
      payments: [cash("1", 500_000)],
      countedCash: 450_000,
      cashSessionId: "s1",
    });
    expect(r.diff).toBe(-50_000);
    expect(r.hasDiscrepancy).toBe(true);
  });

  it("ortiqcha naqd — musbat farq", () => {
    const r = closeCashSession({
      openingFloat: 0,
      payments: [cash("1", 500_000)],
      countedCash: 520_000,
      cashSessionId: "s1",
    });
    expect(r.diff).toBe(20_000);
  });

  it("karta to'lovi kutilgan naqdga kirmaydi", () => {
    const r = closeCashSession({
      openingFloat: 0,
      payments: [cash("1", 300_000), cash("2", 700_000, { method: "card" })],
      countedCash: 300_000,
      cashSessionId: "s1",
    });
    expect(r.expectedCash).toBe(300_000);
    expect(r.diff).toBe(0);
  });

  it("bekor qilingan to'lov kutilgan naqdni kamaytiradi", () => {
    const r = closeCashSession({
      openingFloat: 0,
      payments: [
        cash("1", 5_000_000, { voidedAt: new Date() }),
        cash("2", -5_000_000, { reversalOfId: "1" }),
        cash("3", 400_000),
      ],
      countedCash: 400_000,
      cashSessionId: "s1",
    });
    expect(r.expectedCash).toBe(400_000);
    expect(r.diff).toBe(0);
  });

  it("boshqa smenaning to'lovi kirmaydi", () => {
    const r = closeCashSession({
      openingFloat: 0,
      payments: [cash("1", 300_000), cash("2", 900_000, { cashSessionId: "s2" })],
      countedCash: 300_000,
      cashSessionId: "s1",
    });
    expect(r.expectedCash).toBe(300_000);
  });

  it("manfiy sanalgan naqd rad etiladi", () => {
    expect(() =>
      closeCashSession({ openingFloat: 0, payments: [], countedCash: -1 }),
    ).toThrow(CashSessionError);
  });
});
