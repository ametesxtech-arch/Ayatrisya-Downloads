import { describe, expect, it } from "vitest";
import {
  getGuestImageGenerationCount,
  reserveGuestImageGeneration,
} from "../ai/guest-image-quota";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); },
    clear: () => values.clear(),
    removeItem: (key) => { values.delete(key); },
    key: (index) => Array.from(values.keys())[index] ?? null,
    get length() { return values.size; },
  };
}

describe("guest image generation allowance", () => {
  it("allows two reservations and blocks a third", () => {
    const storage = memoryStorage();
    reserveGuestImageGeneration(storage);
    reserveGuestImageGeneration(storage);
    expect(getGuestImageGenerationCount(storage)).toBe(2);
    expect(() => reserveGuestImageGeneration(storage)).toThrow(/allowance used/);
  });

  it("releases a reservation when generation fails", () => {
    const storage = memoryStorage();
    const release = reserveGuestImageGeneration(storage);
    release();
    expect(getGuestImageGenerationCount(storage)).toBe(0);
  });

  it("fails closed for invalid or unavailable storage state", () => {
    const invalidStorage = { getItem: () => "broken", setItem: () => undefined };
    expect(getGuestImageGenerationCount(invalidStorage)).toBe(2);
    expect(() => reserveGuestImageGeneration(invalidStorage)).toThrow(/allowance used/);
  });
});
