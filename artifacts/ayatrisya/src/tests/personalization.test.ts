import { describe, expect, it } from "vitest";
import { applyPersonalization } from "../ai/personalization";
import { wallpapers } from "../data/wallpapers";
import { defaultPreferences } from "../storage/types";

describe("workspace personalization", () => {
  it("provides exactly 70 uniquely selectable app wallpapers", () => {
    expect(wallpapers).toHaveLength(70);
    expect(new Set(wallpapers.map((wallpaper) => wallpaper.id)).size).toBe(70);
    expect(new Set(wallpapers.map((wallpaper) => wallpaper.src)).size).toBe(70);
    expect(wallpapers.every((wallpaper) => wallpaper.src.startsWith("data:image/svg+xml,"))).toBe(true);
  });

  it("adds saved response guidance only to a request copy and keeps memory opt-in", () => {
    const messages = [{ role: "user" as const, content: "Explain this simply." }];
    const personalized = applyPersonalization(messages, {
      ...defaultPreferences.personalization,
      tone: "direct",
      length: "concise",
      memorySummary: "I am learning TypeScript.",
      useMemory: false,
    });
    expect(personalized).not.toBe(messages);
    expect(personalized[0].content).toContain("Be direct");
    expect(personalized[0].content).toContain("Prefer concise");
    expect(personalized[0].content).not.toContain("I am learning TypeScript");
    expect(messages[0].content).toBe("Explain this simply.");
  });

  it("does not add personalization when disabled or no user prompt is present", () => {
    const messages = [{ role: "user" as const, content: "Hello" }];
    expect(applyPersonalization(messages, { ...defaultPreferences.personalization, enabled: false })).toBe(messages);
    expect(applyPersonalization([{ role: "assistant", content: "Hi" }], defaultPreferences.personalization)).toEqual([
      { role: "assistant", content: "Hi" },
    ]);
  });
});
