import { describe, expect, it } from "vitest";
import {
  PaymentReversalError,
  type PaymentRow,
  buildReversal,
  livePayments,
  sumCashPayments,
  sumPayments,
} from "./payments";

const p = (over: Partial<PaymentRow> & { id: string; amount: number }): PaymentRow => ({
  method: "cash",
  ...over,
});

describe("sumPayments — kanonik qoida", () => {
  it("oddiy jamlash", () => {
    expect(sumPayments([p({ id: "1", amount: 300_000 }), p({ id: "2", amount: 200_000 })])).toBe(
      500_000,
    );
  });

  it("o'chirilgan qator hisobga kirmaydi", () => {
    const rows = [p({ id: "1", amount: 300_000 }), p({ id: "2", amount: 200_000, deletedAt: new Date() })];
    expect(sumPayments(rows)).toBe(300_000);
  });

  it("tuzatuvchi manfiy qator summani nolga chiqaradi", () => {
    const rows = [
      p({ id: "1", amount: 5_000_000, voidedAt: new Date() }),
      p({ id: "2", amount: -5_000_000, reversalOfId: "1" }),
      p({ id: "3", amount: 500_000 }),
    ];
    expect(sumPayments(rows)).toBe(500_000);
  });

  it("⚠️ voidedAt summaga TA'SIR QILMAYDI — ikki marta ayrilmasin", () => {
    // Bu test kanonik qoidani qulflaydi. Kimdir kelajakda sumPayments ichiga
    // "voidedAt IS NULL" filtrini qo'shsa, shu test qulaydi — va to'g'ri qiladi:
    // tuzatuvchi qator allaqachon ayirgan, ikkinchi marta ayirish XATO.
    const rows = [
      p({ id: "1", amount: 1_000_000, voidedAt: new Date() }),
      p({ id: "2", amount: -1_000_000, reversalOfId: "1" }),
    ];
    expect(sumPayments(rows)).toBe(0);
    expect(sumPayments(rows)).not.toBe(-1_000_000); // filtr qo'shilsa shunday bo'lardi
  });

  it("livePayments faqat deletedAt bo'yicha filtrlaydi", () => {
    const rows = [
      p({ id: "1", amount: 100, voidedAt: new Date() }),
      p({ id: "2", amount: 200, deletedAt: new Date() }),
    ];
    expect(livePayments(rows).map((r) => r.id)).toEqual(["1"]);
  });
});

describe("sumCashPayments", () => {
  it("faqat naqdni oladi", () => {
    const rows = [
      p({ id: "1", amount: 300_000, method: "cash" }),
      p({ id: "2", amount: 700_000, method: "card" }),
    ];
    expect(sumCashPayments(rows)).toBe(300_000);
  });

  it("smena bo'yicha filtrlaydi", () => {
    const rows = [
      p({ id: "1", amount: 300_000, method: "cash", cashSessionId: "s1" }),
      p({ id: "2", amount: 400_000, method: "cash", cashSessionId: "s2" }),
    ];
    expect(sumCashPayments(rows, "s1")).toBe(300_000);
  });
});

describe("buildReversal", () => {
  const original = p({ id: "pay-1", amount: 5_000_000 });

  it("manfiy summali tuzatuvchi yozuv tayyorlaydi", () => {
    const d = buildReversal(original, { byUserId: "u1", reason: "Nol ortiqcha kiritilgan" });
    expect(d.insert.amount).toBe(-5_000_000);
    expect(d.insert.reversalOfId).toBe("pay-1");
    expect(d.markOriginal.voidedBy).toBe("u1");
    expect(d.markOriginal.voidReason).toBe("Nol ortiqcha kiritilgan");
  });

  it("allaqachon bekor qilinganni qayta bekor qilmaydi", () => {
    const voided = p({ id: "x", amount: 100, voidedAt: new Date() });
    expect(() => buildReversal(voided, { byUserId: "u1", reason: "sabab" })).toThrow(
      PaymentReversalError,
    );
  });

  it("tuzatuvchi yozuvni qayta tuzatmaydi", () => {
    const rev = p({ id: "x", amount: -100, reversalOfId: "pay-1" });
    expect(() => buildReversal(rev, { byUserId: "u1", reason: "sabab" })).toThrow(
      PaymentReversalError,
    );
  });

  it("o'chirilgan to'lovni tuzatmaydi", () => {
    const del = p({ id: "x", amount: 100, deletedAt: new Date() });
    expect(() => buildReversal(del, { byUserId: "u1", reason: "sabab" })).toThrow(
      PaymentReversalError,
    );
  });

  it("sababsiz bekor qilishga yo'l qo'ymaydi", () => {
    expect(() => buildReversal(original, { byUserId: "u1", reason: "  " })).toThrow(
      PaymentReversalError,
    );
  });
});
