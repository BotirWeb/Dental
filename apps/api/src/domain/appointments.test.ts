import { describe, expect, it } from "vitest";
import { findAppointmentConflicts, timeRangesOverlap } from "./appointments";

const at = (h: number, m = 0) => new Date(2026, 0, 1, h, m);

describe("timeRangesOverlap", () => {
  it("kesishmaydigan oraliqlar", () => {
    expect(timeRangesOverlap({ startAt: at(9), endAt: at(10) }, { startAt: at(11), endAt: at(12) })).toBe(false);
  });

  it("chegara ustma-ust (10:00 tugab, 10:00 boshlanadi) — kesishmaydi", () => {
    expect(timeRangesOverlap({ startAt: at(9), endAt: at(10) }, { startAt: at(10), endAt: at(11) })).toBe(false);
  });

  it("qisman kesishadi", () => {
    expect(timeRangesOverlap({ startAt: at(9), endAt: at(10, 30) }, { startAt: at(10), endAt: at(11) })).toBe(true);
  });

  it("biri ikkinchisini to'liq qamrab oladi", () => {
    expect(timeRangesOverlap({ startAt: at(9), endAt: at(12) }, { startAt: at(10), endAt: at(11) })).toBe(true);
  });
});

describe("findAppointmentConflicts", () => {
  const existing = [
    { id: "1", chairId: "chair-1", doctorId: "doc-1", startAt: at(9), endAt: at(10) },
    { id: "2", chairId: "chair-2", doctorId: "doc-2", startAt: at(11), endAt: at(12) },
  ];

  it("bo'sh vaqt/kreslo — to'qnashuv yo'q", () => {
    const candidate = { chairId: "chair-1", doctorId: "doc-3", startAt: at(10), endAt: at(11) };
    expect(findAppointmentConflicts(candidate, existing)).toHaveLength(0);
  });

  it("bir xil kreslo, kesishuvchi vaqt — to'qnashuv", () => {
    const candidate = { chairId: "chair-1", doctorId: "doc-9", startAt: at(9, 30), endAt: at(10, 30) };
    expect(findAppointmentConflicts(candidate, existing)).toHaveLength(1);
  });

  it("bir xil shifokor, boshqa kreslo, kesishuvchi vaqt — to'qnashuv", () => {
    const candidate = { chairId: "chair-9", doctorId: "doc-1", startAt: at(9, 30), endAt: at(10, 30) };
    expect(findAppointmentConflicts(candidate, existing)).toHaveLength(1);
  });

  it("o'zini yangilashda o'ziga to'qnashuv deb hisoblanmaydi", () => {
    const candidate = { id: "1", chairId: "chair-1", doctorId: "doc-1", startAt: at(9), endAt: at(10) };
    expect(findAppointmentConflicts(candidate, existing)).toHaveLength(0);
  });
});
