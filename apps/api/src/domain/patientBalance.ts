import { type PaymentRow, sumPayments } from "./payments";

/**
 * BEMOR QARZI — tahlil B3.
 *
 * SOF FUNKSIYALAR (qollanma bo'lim 9, qoida 1). Test MAJBURIY (qoida 6).
 *
 * Muammo: 4-ekranda "qarz" ko'rsatiladi, lekin formula hech qayerda
 * yozilmagan edi. Avans, chegirma, kafolat va tuzatuvchi to'lov
 * aralashganda formulani har kim har xil tushunishi mumkin —
 * va ikki xil ekran ikki xil raqam ko'rsatadi.
 *
 * KANONIK FORMULA (shu yerda, bir marta):
 *
 *     hisoblandi = Σ (price_snapshot * qty - discount_amount)
 *                  [kafolat bo'lsa 0 — "tushum yo'q, xarajat bor"]
 *     to'landi   = Σ to'lovlar  (tuzatuvchi manfiy qatorlar bilan birga)
 *     balans     = hisoblandi - to'landi
 *
 *     balans > 0  -> BEMOR QARZDOR
 *     balans < 0  -> AVANS (klinika qarzdor)
 *     balans = 0  -> hisob yopiq
 */

export interface ChargeRow {
  priceSnapshot: number;
  qty: number;
  /** Hisoblangan chegirma so'mda (src/domain/discount.ts). */
  discountAmount: number;
  isWarranty: boolean;
  deletedAt?: Date | null;
}

export interface PatientBalance {
  charged: number;
  paid: number;
  /** Musbat = bemor qarzdor; manfiy = avans. */
  balance: number;
  debt: number;
  advance: number;
}

/** Bitta bajarilgan xizmatdan hisoblangan summa (chegirma ayirilgan). */
export function chargeOf(row: ChargeRow): number {
  if (row.deletedAt) return 0;
  if (row.isWarranty) return 0;
  const total = row.priceSnapshot * row.qty - row.discountAmount;
  return Math.round(Math.max(total, 0));
}

export function calculatePatientBalance(
  charges: readonly ChargeRow[],
  payments: readonly PaymentRow[],
): PatientBalance {
  const charged = charges.reduce((acc, c) => acc + chargeOf(c), 0);
  const paid = sumPayments(payments);
  const balance = charged - paid;

  return {
    charged,
    paid,
    balance,
    debt: balance > 0 ? balance : 0,
    advance: balance < 0 ? -balance : 0,
  };
}
