import { describe, expect, it } from "vitest";
import { isSessionExpired, shouldRefreshActivity } from "./sessionExpiry";

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

describe("isSessionExpired", () => {
  const base = new Date("2026-01-01T12:00:00Z");

  it("hammasi yangi bo'lsa — muddati o'tmagan", () => {
    expect(
      isSessionExpired({
        now: base,
        expiresAt: new Date(base.getTime() + 7 * 24 * HOUR),
        lastActivityAt: base,
        idleHours: 12,
      }),
    ).toBe(false);
  });

  it("IDLE: 12 soatdan ortiq harakatsiz — muddati o'tgan", () => {
    expect(
      isSessionExpired({
        now: new Date(base.getTime() + 12 * HOUR + MIN),
        expiresAt: new Date(base.getTime() + 7 * 24 * HOUR),
        lastActivityAt: base,
        idleHours: 12,
      }),
    ).toBe(true);
  });

  it("IDLE: 12 soatdan kam — hali yaroqli", () => {
    expect(
      isSessionExpired({
        now: new Date(base.getTime() + 11 * HOUR),
        expiresAt: new Date(base.getTime() + 7 * 24 * HOUR),
        lastActivityAt: base,
        idleHours: 12,
      }),
    ).toBe(false);
  });

  it("ABSOLYUT: doim faol bo'lsa ham 7 kundan keyin muddati o'tadi", () => {
    const lastActivityAt = new Date(base.getTime() + 6 * 24 * HOUR + 23 * HOUR); // doim faol
    expect(
      isSessionExpired({
        now: new Date(base.getTime() + 7 * 24 * HOUR + MIN),
        expiresAt: new Date(base.getTime() + 7 * 24 * HOUR),
        lastActivityAt,
        idleHours: 12,
      }),
    ).toBe(true);
  });

  it("chegara ustida (now === expiresAt) — muddati o'tgan hisoblanadi", () => {
    const expiresAt = new Date(base.getTime() + 7 * 24 * HOUR);
    expect(
      isSessionExpired({ now: expiresAt, expiresAt, lastActivityAt: base, idleHours: 12 }),
    ).toBe(true);
  });
});

describe("shouldRefreshActivity", () => {
  const base = new Date("2026-01-01T12:00:00Z");

  it("5 daqiqadan kam o'tgan bo'lsa — yangilanmaydi", () => {
    expect(
      shouldRefreshActivity({ now: new Date(base.getTime() + 4 * MIN), lastActivityAt: base, minIntervalMinutes: 5 }),
    ).toBe(false);
  });

  it("5 daqiqa yoki ko'proq o'tsa — yangilanadi", () => {
    expect(
      shouldRefreshActivity({ now: new Date(base.getTime() + 5 * MIN), lastActivityAt: base, minIntervalMinutes: 5 }),
    ).toBe(true);
  });
});
