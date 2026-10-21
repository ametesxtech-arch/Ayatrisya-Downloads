import { describe, expect, it } from "vitest";
import { consumeModelRequest } from "./model-rate-limit";

describe("per-user model rate limits", () => {
  it("limits generation separately for each authenticated user", () => {
    const now = 1_000_000;
    for (let count = 0; count < 10; count += 1) {
      expect(consumeModelRequest("user-a", true, now)).toEqual({ allowed: true });
    }
    expect(consumeModelRequest("user-a", true, now).allowed).toBe(false);
    expect(consumeModelRequest("user-b", true, now)).toEqual({ allowed: true });
  });

  it("limits total calls per minute and resets the window", () => {
    const now = 2_000_000;
    for (let count = 0; count < 60; count += 1) {
      expect(consumeModelRequest("user-c", false, now)).toEqual({ allowed: true });
    }
    expect(consumeModelRequest("user-c", false, now)).toMatchObject({
      allowed: false,
      retryAfterSeconds: 60,
    });
    expect(consumeModelRequest("user-c", false, now + 60_001)).toEqual({ allowed: true });
  });
});
