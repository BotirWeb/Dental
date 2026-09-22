import type { UserRole } from "@dental/shared";

/**
 * Qollanma bo'lim 6 "MVP qamrovi — ekranlar" jadvali, kod sifatida.
 * Navigatsiya (Shell.tsx) va route'lar (App.tsx) shu BITTA ro'yxatdan
 * generatsiya qilinadi — ekran qo'shilsa/o'zgarsa, ikkalasi ham avtomatik
 * yangilanadi (nav bilan route orasida farq bo'lib qolmaydi).
 *
 * Rol ustunlari ikkita jadvaldan birlashtirilgan: bo'lim 6'dagi har-ekran
 * "Kim" ustuni + "Rollar" jadvalidagi "owner: ko'radi hammasi". Shuning
 * uchun `owner` HAR DOIM ro'yxatda, hujjatning har-ekran ustunida
 * yozilmagan bo'lsa ham.
 */

const OWNER: UserRole[] = ["owner"];

export interface ScreenDef {
  /** Bo'lim 6 jadvalidagi tartib raqami — traceability uchun. */
  screenNumber: number;
  path: string;
  label: string;
  roles: UserRole[];
  status: "ready" | "todo";
  /** Qaysi hafta/fazada quriladi (bo'lim 7 ichki tartibi). */
  note?: string;
}

export const SCREENS: ScreenDef[] = [
  {
    screenNumber: 2,
    path: "/schedule",
    label: "Jadval",
    roles: [...OWNER, "admin", "doctor"],
    status: "ready",
    note: "Kun ko'rinishi (kreslo × vaqt grid) ishlaydi — hafta ko'rinishi hali yo'q",
  },
  {
    screenNumber: 3,
    path: "/patients",
    label: "Bemorlar",
    roles: [...OWNER, "admin", "doctor"],
    status: "ready",
    note: "Namuna slice: qidirish + yaratish ishlaydi (to'liq ekran 3/4 — hafta 3-4)",
  },
  {
    screenNumber: 6,
    path: "/cashier",
    label: "Kassa / vizit yakuni",
    roles: [...OWNER, "admin", "cashier"],
    status: "ready",
    note: "Smena, vizit, xizmat, to'lov — bajarildi (2026-09-22)",
  },
  {
    screenNumber: 7,
    path: "/expenses",
    label: "Xarajatlar",
    roles: [...OWNER, "admin"],
    status: "ready",
    note: "Ro'yxat + qo'shish — bajarildi (2026-09-22)",
  },
  {
    screenNumber: 11,
    path: "/services",
    label: "Xizmat va narxlar",
    roles: OWNER,
    status: "ready",
    note: "Xizmat/kategoriya CRUD, narx tahrirlash — bajarildi (2026-09-22)",
  },
  {
    screenNumber: 8,
    path: "/reports/daily",
    label: "Kunlik hisobot",
    roles: OWNER,
    status: "todo",
    note: "Hafta 9-11",
  },
  {
    screenNumber: 9,
    path: "/reports/margin",
    label: "Oylik marja",
    roles: OWNER,
    status: "todo",
    note: "Hafta 9-11 — asosiy farqlanish nuqtasi (bo'lim 1)",
  },
  {
    screenNumber: 10,
    path: "/reports/doctors",
    label: "Shifokor hisobi",
    roles: OWNER,
    status: "todo",
    note: "Hafta 9-11",
  },
  {
    screenNumber: 12,
    path: "/users",
    label: "Foydalanuvchilar",
    roles: OWNER,
    status: "todo",
  },
];
