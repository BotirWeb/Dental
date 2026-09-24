/**
 * T5 "Tish kartasi" — saqlash qarori (sof funksiya, HTTP/DB'siz).
 *
 * Karta tahrirlanmaydi: har saqlash `dental_charts`ga YANGI qator (versiya),
 * joriy karta = eng oxirgi o'chirilmagan qator. Muammo — ikki kishi bir
 * vaqtda: shifokor A va B bitta kartani ochadi, A saqlaydi, keyin B saqlaydi
 * — B ning versiyasi A ning o'zgarishini ko'rmagan holda ustiga tushadi va
 * A ning ishi jimgina yo'qoladi ("lost update").
 *
 * Yechim — optimistik qulf: mijoz qaysi versiyani ochganini (`baseChartId`)
 * yuboradi, server uni hozirgi oxirgi versiya bilan solishtiradi. Mos
 * kelmasa — 409, foydalanuvchi yangilab qayta kiritadi. Tekshiruv va yozuv
 * route'da bitta tranzaksiyada, bemor qatori `FOR UPDATE` bilan qulflanib
 * bajariladi — aks holda ikkita parallel so'rov ikkalasi ham tekshiruvdan
 * o'tib ketishi mumkin edi.
 */

export type ChartSaveDecision = { kind: "ok" } | { kind: "conflict" };

export function decideChartSave(input: {
  /** Hozir DB'dagi oxirgi (o'chirilmagan) versiya, karta yo'q bo'lsa null. */
  latestChartId: string | null;
  /** Mijoz ochgan versiya, u ochganda karta yo'q bo'lgan bo'lsa null. */
  baseChartId: string | null;
}): ChartSaveDecision {
  // Ikkalasi null: birinchi karta, hech kim oldin saqlamagan — ok.
  // Ikkalasi bir xil id: mijoz eng oxirgi versiya ustida ishlagan — ok.
  // Qolgan hamma holat to'qnashuv:
  //   - latest bor, base null  -> mijoz ochganda karta yo'q edi, oraliqda kimdir birinchisini saqlagan;
  //   - latest null, base bor  -> mijoz ochgan versiya endi yo'q (o'chirilgan);
  //   - ikkalasi bor, har xil  -> oraliqda yangi versiya saqlangan.
  return input.latestChartId === input.baseChartId ? { kind: "ok" } : { kind: "conflict" };
}

/** JSON matnining UTF-8 bayt hajmi — `DENTAL_CHART_MAX_BYTES` bilan solishtirish uchun. */
export function jsonByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}
