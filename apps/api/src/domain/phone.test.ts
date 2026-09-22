import { describe, expect, it } from "vitest";
import { formatUzPhone, isValidUzPhone, normalizePhone } from "@dental/shared";

describe("normalizePhone", () => {
  it.each([
    ["+998901234567", "901234567"],
    ["998901234567", "901234567"],
    ["901234567", "901234567"],
    ["90 123 45 67", "901234567"],
    ["+998 (90) 123-45-67", "901234567"],
    ["8 90 123 45 67", "901234567"],
    ["71 123 45 67", "711234567"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it("bir xil odamning uch xil yozuvi bitta natijaga keladi", () => {
    const variants = ["+998901234567", "901234567", "90 123 45 67"];
    const normalized = new Set(variants.map(normalizePhone));
    expect(normalized.size).toBe(1);
  });

  it("tanib bo'lmaydigan raqamda ma'lumot yo'qolmaydi", () => {
    expect(normalizePhone("12345")).toBe("12345");
  });
});

describe("isValidUzPhone", () => {
  it("to'g'ri raqam", () => {
    expect(isValidUzPhone("+998901234567")).toBe(true);
  });

  it("kalta raqam", () => {
    expect(isValidUzPhone("12345")).toBe(false);
  });
});

describe("formatUzPhone", () => {
  it("chiroyli ko'rinish", () => {
    expect(formatUzPhone("901234567")).toBe("+998 90 123 45 67");
  });

  it("yaroqsiz raqam asl holida qoladi", () => {
    expect(formatUzPhone("12345")).toBe("12345");
  });
});
