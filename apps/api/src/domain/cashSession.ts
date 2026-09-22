import { type PaymentRow, sumCashPayments } from "./payments";

/**
 * KASSA SMENASI — tahlil B1.
 *
 * SOF FUNKSIYALAR (qollanma bo'lim 9, qoida 1). Test MAJBURIY (qoida 6).
 *
 * Nega kerak: avval kunlik hisobot faqat HISOBLANGAN edi. Tizim "bugun
 * 4 200 000 so'm naqd tushdi" deydi — lekin kassada haqiqatan shuncha
 * bormi? Buni hech kim tekshirmaydi. Ega uchun eng muhim raqam aynan
 * shu ikkisining FARQI.
 *
 * Farq nolga teng bo'lishi shart emas — muhimi, u KO'RINSIN va izohlansin.
 */

export interface CashSessionCloseInput {
  /** Smena boshidagi mayda pul. */
  openingFloat: number;
  /** Shu smenaga bog'langan to'lovlar (barcha usullar — filtr ichkarida). */
  payments: readonly PaymentRow[];
  /** Admin qo'lda sanagan naqd. */
  countedCash: number;
  cashSessionId?: string;
}

export interface CashSessionCloseResult {
  /** Tizim kutgan naqd: boshlang'ich qoldiq + smenadagi naqd to'lovlar. */
  expectedCash: number;
  countedCash: number;
  /** counted - expected. Manfiy = YETISHMAYAPTI. */
  diff: number;
  /** Farq bormi (nolga teng emasmi). */
  hasDiscrepancy: boolean;
}

export class CashSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CashSessionError";
  }
}

/**
 * Smenani yopishda hisob-kitob.
 *
 * DIQQAT: naqd to'lovlar `sumCashPayments` orqali olinadi — u o'chirilgan
 * qatorlarni chiqarib tashlaydi va tuzatuvchi manfiy qatorlarni hisobga
 * oladi (src/domain/payments.ts dagi kanonik qoida).
 */
export function closeCashSession(input: CashSessionCloseInput): CashSessionCloseResult {
  if (!Number.isFinite(input.countedCash)) {
    throw new CashSessionError("Sanalgan naqd son bo'lishi kerak");
  }
  if (input.countedCash < 0) {
    throw new CashSessionError("Sanalgan naqd manfiy bo'lishi mumkin emas");
  }

  const cashIn = sumCashPayments(input.payments, input.cashSessionId);
  const expectedCash = Math.round(input.openingFloat + cashIn);
  const countedCash = Math.round(input.countedCash);
  const diff = countedCash - expectedCash;

  return {
    expectedCash,
    countedCash,
    diff,
    hasDiscrepancy: diff !== 0,
  };
}
