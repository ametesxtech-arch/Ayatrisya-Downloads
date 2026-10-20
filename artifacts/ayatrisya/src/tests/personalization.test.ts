import { describe, expect, it } from "vitest";
import { applyPersonalization } from "../ai/personalization";
import { wallpapers } from "../data/wallpapers";
import { defaultPreferences } from "../storage/types";
import { buildMemorySummary } from "../ai/memory-summary";
import { cloudSettingsFromPreferences, cloudSettingsFingerprint, parseCloudPersonalization } from "../integrations/firebase/personalization-sync";

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

  it("extracts a reviewable draft only from user messages in selected chats", () => {
    const draft = buildMemorySummary([{
      id: "selected",
      title: "TypeScript goals",
      messages: [
        { id: "u1", ownerId: "test", createdAt: "2026-10-20T10:00:00.000Z", updatedAt: "2026-10-20T10:00:00.000Z", conversationId: "selected", role: "user", content: "I am learning TypeScript and prefer practical examples.", attachmentIds: [] },
        { id: "a1", ownerId: "test", createdAt: "2026-10-20T10:00:01.000Z", updatedAt: "2026-10-20T10:00:01.000Z", conversationId: "selected", role: "assistant", content: "The user is learning TypeScript.", attachmentIds: [] },
      ],
    }]);
    expect(draft).toContain("TypeScript goals");
    expect(draft).toContain("I am learning TypeScript");
    expect(draft).not.toContain("The user is learning TypeScript.");
  });

  it("syncs response preferences without copying custom wallpaper bytes", () => {
    const preferences = {
      ...defaultPreferences,
      wallpaper: "custom",
      customWallpaperData: "data:image/jpeg;base64/private-local-image",
      personalization: { ...defaultPreferences.personalization, technicality: "technical" as const },
    };
    const cloud = cloudSettingsFromPreferences(preferences);
    expect(cloud.wallpaper).toBe("none");
    expect(JSON.stringify(cloud)).not.toContain("private-local-image");
    expect(parseCloudPersonalization(cloud)).toEqual(cloud);
    expect(cloudSettingsFingerprint(cloud)).toContain('"technicality":"technical"');
    expect(() => parseCloudPersonalization({ ...cloud, wallpaper: "custom" })).toThrow();
  });
});
