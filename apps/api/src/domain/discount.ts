import type { DiscountType } from "@dental/shared";

/**
 * CHEGIRMA HISOBI — tahlil B2.
 *
 * SOF FUNKSIYA (qollanma bo'lim 9, qoida 1). Test MAJBURIY (qoida 6).
 *
 * Muammo nima edi:
 *   - `discount` bitta ustun edi, so'mmi/foizmi noaniq ("FARAZ QILINDI").
 *   - `Math.max(gross, 0)` xatoni JIMGINA yutardi: chegirma narxdan katta
 *     bo'lsa tushum 0 chiqardi, hech kim bilmasdi.
 *
 * Endi:
 *   - tur aniq (`amount` | `percent`),
 *   - chegirma SATR jamisiga qo'llanadi (price * qty), donaga emas,
 *   - yaroqsiz chegirma JIMGINA tuzatilmaydi — xato tashlanadi, API uni
 *     400 qilib qaytaradi va admin ekranda ko'radi.
 */

export class DiscountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscountError";
  }
}

export interface DiscountInput {
  type: DiscountType;
  /** "amount" -> so'm; "percent" -> 0..100 */
  value: number;
}

/** Satr jamisi — chegirmadan OLDIN. */
export function lineTotal(priceSnapshot: number, qty: number): number {
  return Math.round(priceSnapshot * qty);
}

/**
 * Chegirmani so'mga aylantiradi va TEKSHIRADI.
 *
 * @throws DiscountError — manfiy qiymat, 100% dan katta foiz, yoki satr
 *         jamisidan oshib ketgan so'm chegirmasi.
 */
export function computeDiscountAmount(discount: DiscountInput, total: number): number {
  if (!Number.isFinite(discount.value)) {
    throw new DiscountError("Chegirma qiymati son bo'lishi kerak");
  }
  if (discount.value < 0) {
    throw new DiscountError("Chegirma manfiy bo'lishi mumkin emas");
  }
  if (total < 0) {
    throw new DiscountError("Satr jamisi manfiy bo'lishi mumkin emas");
  }

  let amount: number;

  if (discount.type === "percent") {
    if (discount.value > 100) {
      throw new DiscountError("Foiz chegirma 100 dan katta bo'lishi mumkin emas");
    }
    amount = Math.round((total * discount.value) / 100);
  } else {
    amount = Math.round(discount.value);
  }

  if (amount > total) {
    throw new DiscountError(
      `Chegirma (${amount} so'm) xizmat summasidan (${total} so'm) katta bo'lishi mumkin emas`,
    );
  }

  return amount;
}

/**
 * Yaroqlilikni xato tashlamasdan tekshirish — forma validatsiyasi uchun.
 * Xato matni foydalanuvchiga ko'rsatiladi, `null` = hammasi joyida.
 */
export function validateDiscount(discount: DiscountInput, total: number): string | null {
  try {
    computeDiscountAmount(discount, total);
    return null;
  } catch (err) {
    if (err instanceof DiscountError) return err.message;
    throw err;
  }
}
