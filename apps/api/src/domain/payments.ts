/**
 * TO'LOVLARNI TUZATISH VA JAMLASH — tahlil A3.
 *
 * SOF FUNKSIYALAR (qollanma bo'lim 9, qoida 1). Test MAJBURIY (qoida 6).
 *
 * ┌─ KANONIK QOIDA ────────────────────────────────────────────────────────┐
 * │ Hisobot `deleted_at IS NULL` bo'lgan BARCHA qatorlarni qo'shadi.       │
 * │ Tuzatuvchi yozuv manfiy, shuning uchun o'zi nolga chiqaradi.           │
 * │ `voided_at` ni filtrda ISHLATMANG — summa ikki marta ayriladi.         │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * Nega ikkala mexanizm ham bor:
 *   - tuzatuvchi yozuv  → pul harakati to'liq ko'rinadi (revizor uchun),
 *   - `voided_at`       → interfeys asl qatorni chizib ko'rsatadi.
 * Ular BIR-BIRINI ALMASHTIRMAYDI: biri hisob uchun, biri ko'rinish uchun.
 * Shuning uchun quyidagi `sumPayments` ataylab `voidedAt` ni e'tiborsiz
 * qoldiradi — va buni test qulflab turadi.
 */

export interface PaymentRow {
  id: string;
  amount: number;
  /** Bu qator qaysi to'lovni tuzatyapti (manfiy summali qator uchun). */
  reversalOfId?: string | null;
  /** Asl qatorda: bekor qilingan belgisi. HISOBGA TA'SIR QILMAYDI. */
  voidedAt?: Date | null;
  /** Umuman bo'lmasligi kerak bo'lgan qator. Hisobdan CHIQARILADI. */
  deletedAt?: Date | null;
  method?: string;
  cashSessionId?: string | null;
}

/** Hisobga kiradigan qatorlar: faqat `deleted_at IS NULL`. */
export function livePayments<T extends PaymentRow>(rows: readonly T[]): T[] {
  return rows.filter((r) => !r.deletedAt);
}

/**
 * Kanonik jami. `voidedAt` ATAYLAB e'tiborga olinmaydi — tuzatuvchi
 * manfiy qator allaqachon ayirgan.
 */
export function sumPayments(rows: readonly PaymentRow[]): number {
  return livePayments(rows).reduce((acc, r) => acc + r.amount, 0);
}

/** Faqat naqd — kassa smenasi uchun (tahlil B1). */
export function sumCashPayments(rows: readonly PaymentRow[], cashSessionId?: string): number {
  return livePayments(rows)
    .filter((r) => r.method === "cash")
    .filter((r) => (cashSessionId ? r.cashSessionId === cashSessionId : true))
    .reduce((acc, r) => acc + r.amount, 0);
}

export class PaymentReversalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentReversalError";
  }
}

export interface ReversalDraft {
  /** DB'ga qo'shiladigan YANGI qator (manfiy summa). */
  insert: {
    amount: number;
    reversalOfId: string;
    note: string;
  };
  /** ASL qatorga qo'yiladigan belgi. */
  markOriginal: {
    voidedAt: Date;
    voidedBy: string;
    voidReason: string;
  };
}

/**
 * Noto'g'ri to'lovni tuzatish uchun ikkita amalni tayyorlaydi.
 * DB yozuvi chaqiruvchi tomonda (route) bitta tranzaksiyada bajariladi.
 *
 * @throws PaymentReversalError — allaqachon bekor qilingan, o'chirilgan,
 *         yoki o'zi tuzatuvchi bo'lgan qatorni tuzatishga urinish.
 */
export function buildReversal(
  original: PaymentRow,
  opts: { byUserId: string; reason: string; at?: Date },
): ReversalDraft {
  if (original.deletedAt) {
    throw new PaymentReversalError("O'chirilgan to'lovni tuzatib bo'lmaydi");
  }
  if (original.voidedAt) {
    throw new PaymentReversalError("Bu to'lov allaqachon bekor qilingan");
  }
  if (original.reversalOfId) {
    throw new PaymentReversalError("Tuzatuvchi yozuvni qayta tuzatib bo'lmaydi");
  }
  const reason = opts.reason.trim();
  if (reason.length < 3) {
    throw new PaymentReversalError("Bekor qilish sababi ko'rsatilishi shart");
  }

  const at = opts.at ?? new Date();

  return {
    insert: {
      amount: -original.amount,
      reversalOfId: original.id,
      note: `Bekor qilindi: ${reason}`,
    },
    markOriginal: {
      voidedAt: at,
      voidedBy: opts.byUserId,
      voidReason: reason,
    },
  };
}
