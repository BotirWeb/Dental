import { describe, expect, it } from "vitest";
import { decideIdempotency, isValidIdempotencyKey } from "./idempotency";

describe("decideIdempotency", () => {
  it("mavjud yozuv yo'q — claim", () => {
    expect(decideIdempotency(undefined, "hash-a")).toEqual({ kind: "claim" });
  });

  it("mavjud, boshqa tana xeshi — conflict", () => {
    expect(
      decideIdempotency({ requestHash: "hash-a", statusCode: 201, responseBody: "{}" }, "hash-b"),
    ).toEqual({ kind: "conflict" });
  });

  it("mavjud, bir xil tana, hali tugallanmagan (statusCode null) — in_progress", () => {
    expect(
      decideIdempotency({ requestHash: "hash-a", statusCode: null, responseBody: null }, "hash-a"),
    ).toEqual({ kind: "in_progress" });
  });

  it("mavjud, bir xil tana, tugallangan — replay saqlangan javob bilan", () => {
    expect(
      decideIdempotency({ requestHash: "hash-a", statusCode: 201, responseBody: '{"id":"1"}' }, "hash-a"),
    ).toEqual({ kind: "replay", statusCode: 201, responseBody: '{"id":"1"}' });
  });
});

describe("isValidIdempotencyKey", () => {
  it("to'g'ri UUID — yaroqli", () => {
    expect(isValidIdempotencyKey("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("bo'sh yoki yo'q — yaroqsiz", () => {
    expect(isValidIdempotencyKey(undefined)).toBe(false);
    expect(isValidIdempotencyKey(null)).toBe(false);
    expect(isValidIdempotencyKey("")).toBe(false);
  });

  it("UUID bo'lmagan matn — yaroqsiz", () => {
    expect(isValidIdempotencyKey("shunchaki-matn")).toBe(false);
  });
});
