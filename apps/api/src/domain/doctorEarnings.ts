import type { DoctorPctBasis } from "@dental/shared";
import { lineTotal } from "./discount";

/**
 * SOF FUNKSIYA — HTTP va DB'dan ajratilgan (qollanma bo'lim 9, qoida 1).
 * Test yozilishi MAJBURIY (qoida 6: "kassa, marja hisobi, shifokor foizi").
 *
 * Bu yerda ikkita narsa hisoblanadi:
 *   1. calculateDoctorEarning — shifokorga tegishli summa.
 *      OCHIQ SAVOL (bo'lim 13): "tushumdanmi yoki material ayirilgandan
 *      keyinmi?" — javob yo'qligi uchun `basis` parametri orqali
 *      SOZLANADIGAN qilingan, hardcode qilinmagan (clinics.doctor_pct_basis).
 *   2. calculateServiceMargin — klinika marjasi (bo'lim 1: "Marja hisobi —
 *      xizmat bo'yicha... Hech kim qilmaydi" — bu loyihaning asosiy
 *      farqlanish nuqtasi).
 *
 * Barcha summalar so'mda, butun son (money ustunlari numeric(14,0)).
 */

export interface PerformedServiceInput {
  priceSnapshot: number;
  qty: number;
  /**
   * HISOBLANGAN chegirma, so'mda (tahlil B2). Avval bu `discount` deb
   * atalardi va uning so'mmi/foizmi ekani noaniq edi. Endi qiymat
   * `computeDiscountAmount` dan keladi va u yerda TEKSHIRILGAN
   * (satr jamisidan katta bo'la olmaydi).
   */
  discountAmount: number;
  doctorPctSnapshot: number; // 0-100 oralig'ida, kasr bilan (masalan 37.5)
  materialCostSnapshot: number;
  labCost: number;
  /** Kafolat: tushum yo'q, xarajat bor (bo'lim 5, performed_services.is_warranty). */
  isWarranty: boolean;
}

export interface ServiceMarginResult {
  revenue: number;
  doctorEarning: number;
  materialCost: number;
  labCost: number;
  /** Klinika sof marjasi shu xizmatdan: revenue - doctorEarning - materialCost - labCost */
  margin: number;
}

/** So'mga yaxlitlash — pul ustunlari numeric(14,0), kasr bo'lishi mumkin emas. */
function roundSom(value: number): number {
  return Math.round(value);
}

/**
 * Xizmatdan kelgan tushum (chegirma ayirilgan holda).
 * Kafolat bo'yicha qayta ish uchun tushum 0 — bo'lim 5: "kafolat: tushum
 * yo'q, xarajat bor".
 */
export function calculateRevenue(
  ps: Pick<PerformedServiceInput, "priceSnapshot" | "qty" | "discountAmount" | "isWarranty">,
): number {
  if (ps.isWarranty) return 0;

  // `discountAmount` src/domain/discount.ts da allaqachon tekshirilgan
  // (satr jamisidan katta bo'la olmaydi), shuning uchun bu yerda
  // Math.max faqat himoya chorasi — u ishga tushsa, demak chegirma
  // validatsiyasiz kiritilgan va bu XATO.
  const gross = lineTotal(ps.priceSnapshot, ps.qty) - ps.discountAmount;
  return roundSom(Math.max(gross, 0));
}

/**
 * Shifokorga tegishli summa. `basis` clinics.doctor_pct_basis'dan keladi —
 * bitta klinikaning ichida barqaror, lekin klinikalar orasida farqli bo'lishi
 * mumkin (ochiq savol javobi topilmaguncha).
 *
 * FARAZ: kafolat vizitida komissiya to'lanmaydi (tushum yo'qligi sababli).
 * Bu faraz — dala ishida ega bilan tasdiqlanishi kerak (bo'lim 13).
 */
export function calculateDoctorEarning(ps: PerformedServiceInput, basis: DoctorPctBasis): number {
  if (ps.isWarranty) return 0;

  const revenue = calculateRevenue(ps);
  const base = basis === "gross" ? revenue : Math.max(revenue - ps.materialCostSnapshot, 0);

  return roundSom(base * (ps.doctorPctSnapshot / 100));
}

/**
 * Bitta bajarilgan xizmat bo'yicha to'liq marja hisobi. Kreslo-soat bo'yicha
 * agregatsiya (bo'lim 1, ekran 9) — bu funksiyaning ustiga hisobot
 * qatlamida (Faza 1, 9-11 hafta) quriladi, bu yerda emas.
 */
export function calculateServiceMargin(ps: PerformedServiceInput, basis: DoctorPctBasis): ServiceMarginResult {
  const revenue = calculateRevenue(ps);
  const doctorEarning = calculateDoctorEarning(ps, basis);
  // Material/lab xarajati kafolatda ham hisoblanadi — "tushum yo'q, xarajat bor" (bo'lim 5).
  const materialCost = ps.materialCostSnapshot;
  const labCost = ps.labCost;
  const margin = roundSom(revenue - doctorEarning - materialCost - labCost);

  return { revenue, doctorEarning, materialCost, labCost, margin };
}
