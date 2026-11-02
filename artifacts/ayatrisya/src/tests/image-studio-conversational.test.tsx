import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { IMAGE_STYLE_PRESETS, applyStylePreset, getStylePreset } from "@/features/image-studio/styles";
import {
  saveCharacterProfile,
  loadCharacterProfiles,
  deleteCharacterProfile,
  formatCharacterPromptSegment,
  CHARACTER_PROFILES_STORAGE_KEY,
} from "@/features/image-studio/character-profiles";
import {
  composeConversationalPrompt,
} from "@/features/image-studio/prompt-composer";
import {
  hasCloudImageConsent,
  getCloudImageConsentScope,
  grantCloudImageConsent,
  revokeCloudImageConsent,
  subscribeCloudImageConsent,
  CLOUD_IMAGE_CONSENT_DEVICE_KEY,
  CLOUD_IMAGE_CONSENT_SESSION_KEY,
} from "@/features/image-studio/consent";
import type { CharacterProfile } from "@/features/image-studio/types";

function createMockStorage(): Storage {
  const store = new Map<string, string>();
  const target = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };

  return new Proxy(target, {
    get(t, prop) {
      if (prop in t) {
        return (t as any)[prop];
      }
      return store.get(String(prop)) ?? undefined;
    },
    set(t, prop, value) {
      if (prop in t) {
        (t as any)[prop] = value;
        return true;
      }
      store.set(String(prop), String(value));
      return true;
    },
    ownKeys() {
      return Array.from(store.keys());
    },
    getOwnPropertyDescriptor(t, prop) {
      if (store.has(String(prop))) {
        return {
          enumerable: true,
          configurable: true,
          writable: true,
          value: store.get(String(prop)),
        };
      }
      return Object.getOwnPropertyDescriptor(t, prop);
    },
  }) as unknown as Storage;
}

describe("Ayatrisya Image Studio — Conversational Intelligence & Character Consistency", () => {
  let mockLocalStorage: Storage;
  let mockSessionStorage: Storage;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockLocalStorage = createMockStorage();
    mockSessionStorage = createMockStorage();

    vi.stubGlobal("localStorage", mockLocalStorage);
    vi.stubGlobal("sessionStorage", mockSessionStorage);
    vi.stubGlobal("window", {
      localStorage: mockLocalStorage,
      sessionStorage: mockSessionStorage,
    });

    revokeCloudImageConsent();
  });

  afterEach(() => {
    revokeCloudImageConsent();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("1. Artistic Style Presets", () => {
    it("contains all 18 required style presets plus Custom style", () => {
      const requiredStyles = [
        "photorealistic",
        "cinematic",
        "anime",
        "manga",
        "3d-animated",
        "stylized-3d",
        "digital-painting",
        "watercolor",
        "oil-painting",
        "comic-book",
        "pixel-art",
        "fantasy-concept-art",
        "sci-fi",
        "minimalist-illustration",
        "product-photography",
        "architecture-visualization",
        "vintage-film",
        "sketch",
        "custom",
      ];

      expect(IMAGE_STYLE_PRESETS.length).toBe(19);
      for (const id of requiredStyles) {
        const found = IMAGE_STYLE_PRESETS.find((p) => p.id === id);
        expect(found, `Expected style preset ${id} to exist`).toBeDefined();
        expect(found?.label.length).toBeGreaterThan(0);
        expect(found?.badge.length).toBeGreaterThan(0);
      }
    });

    it("correctly appends preset prompt modifiers to base prompts", () => {
      const base = "A solitary lighthouse during a storm";
      const cinematic = applyStylePreset(base, "cinematic");
      expect(cinematic).toContain(base);
      expect(cinematic).toContain("cinematic film still");
      expect(cinematic).toContain("anamorphic");

      const anime = applyStylePreset(base, "anime");
      expect(anime).toContain("modern anime style");
      expect(anime).toContain("clean crisp line art");

      const oil = applyStylePreset(base, "oil-painting");
      expect(oil).toContain("classical oil on canvas");
    });

    it("handles Custom style modifier properly", () => {
      const base = "A cozy coffee shop";
      const customResult = applyStylePreset(base, "custom", "hyper-detailed airbrush 1980s retro synthwave");
      expect(customResult).toBe("A cozy coffee shop, hyper-detailed airbrush 1980s retro synthwave");

      // Empty custom modifier keeps base prompt unchanged
      const emptyCustom = applyStylePreset(base, "custom", "");
      expect(emptyCustom).toBe("A cozy coffee shop");
    });
  });

  describe("2. Character Profiles & Consistency System", () => {
    it("saves, loads, and deletes reusable character profiles", async () => {
      const profileData: Omit<CharacterProfile, "id" | "createdAt" | "updatedAt"> = {
        name: "Captain Lyra Vance",
        appearance: "Athletic build, early 30s, tall",
        hairstyle: "Shoulder-length wavy auburn hair",
        facialFeatures: "Sharp jawline, emerald green eyes",
        skinTone: "Warm olive complexion",
        clothing: "Dark charcoal high-collar trench coat",
        accessories: "Silver compass pendant",
        personality: "Composed, observant, confident",
        consistencyMode: "consistent-face-allow-outfit-changes",
      };

      const saved = await saveCharacterProfile(profileData);
      expect(saved.id).toBeDefined();
      expect(saved.name).toBe("Captain Lyra Vance");

      const list = await loadCharacterProfiles();
      expect(list.some((p) => p.name === "Captain Lyra Vance")).toBe(true);

      await deleteCharacterProfile(saved.id);
      const afterDelete = await loadCharacterProfiles();
      expect(afterDelete.some((p) => p.id === saved.id)).toBe(false);
    });

    it("formats character prompt segment with fixed facial and physical attributes", () => {
      const character: CharacterProfile = {
        id: "char-1",
        name: "Kaelen",
        appearance: "Lean frame, mid 20s",
        hairstyle: "Messy raven black hair",
        facialFeatures: "Intense grey eyes, scar across left eyebrow",
        skinTone: "Pale ivory complexion",
        clothing: "Dark hooded traveler cloak",
        accessories: "Leather wrist wraps",
        personality: "Vigilant, mysterious",
        consistencyMode: "consistent-face-allow-outfit-changes",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const segment = formatCharacterPromptSegment(character, false);
      expect(segment).toContain('featuring character "Kaelen"');
      expect(segment).toContain("Lean frame");
      expect(segment).toContain("Messy raven black hair");
      expect(segment).toContain("Intense grey eyes");
      expect(segment).toContain("Pale ivory complexion");
      expect(segment).toContain("default outfit: Dark hooded traveler cloak");
    });

    it("respects consistencyMode: locks outfit when consistent-face-and-outfit is selected", () => {
      const character: CharacterProfile = {
        id: "char-2",
        name: "Doctor Nora Chen",
        appearance: "Petite, 40s",
        hairstyle: "Neat black bob with bangs",
        facialFeatures: "Dark brown eyes, reading glasses",
        skinTone: "Light golden complexion",
        clothing: "White lab coat with cyan trim",
        accessories: "Stethoscope, badge",
        personality: "Analytical, calm",
        consistencyMode: "consistent-face-and-outfit",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Even if scene prompt specifies an outfit, locked outfit mode insists on signature clothing
      const segment = formatCharacterPromptSegment(character, true);
      expect(segment).toContain("wearing White lab coat with cyan trim");
    });
  });

  describe("3. Multi-Turn Conversational Prompt Synthesis", () => {
    it("handles initial prompt without reference", () => {
      const result = composeConversationalPrompt({
        userInput: "A lone cyberpunk warrior standing on a skyscraper rooftop in the rain",
        styleId: "cinematic",
      });

      expect(result.effectivePrompt).toContain("cyberpunk warrior");
      expect(result.effectivePrompt).toContain("cinematic film still");
      expect(result.honestLimitationNote).toContain("FLUX.1-schnell");
    });

    it("synthesizes follow-up: 'Make the lighting warmer'", () => {
      const initialPrompt = "A futuristic laboratory with glass desks and clean surfaces";
      const result = composeConversationalPrompt({
        userInput: "Make the lighting warmer.",
        referencePrompt: initialPrompt,
        styleId: "photorealistic",
      });

      expect(result.effectivePrompt).toContain("futuristic laboratory");
      expect(result.effectivePrompt).toContain("warm golden hour ambient lighting");
      expect(result.refinementSummary).toContain("Adjusted lighting");
    });

    it("synthesizes follow-up: 'Keep the same character but change the outfit to black'", () => {
      const initialPrompt = "A rogue knight wearing silver plate armor in a forest clearing";
      const result = composeConversationalPrompt({
        userInput: "Keep the same character but change the outfit to black leather armor",
        referencePrompt: initialPrompt,
      });

      expect(result.effectivePrompt).toContain("change the outfit to black leather armor");
      expect(result.refinementSummary).toContain("character outfit");
    });

    it("synthesizes follow-up: 'Put this character in a futuristic city'", () => {
      const initialPrompt = "A mysterious detective standing under a streetlight";
      const result = composeConversationalPrompt({
        userInput: "Put this character in a futuristic city with holographic billboards",
        referencePrompt: initialPrompt,
      });

      expect(result.effectivePrompt).toContain("mysterious detective");
      expect(result.effectivePrompt).toContain("set in a futuristic city with holographic billboards");
      expect(result.refinementSummary).toContain("Transposed subject to new environment");
    });

    it("dynamically detects style override: 'Make it anime style instead'", () => {
      const initialPrompt = "A magical girl summoning starlight in an ancient ruin";
      const result = composeConversationalPrompt({
        userInput: "Make it anime style instead",
        referencePrompt: initialPrompt,
        styleId: "photorealistic",
      });

      expect(result.detectedStyleOverride).toBe("anime");
      expect(result.effectivePrompt).toContain("modern anime style");
    });

    it("synthesizes follow-up: 'Keep everything the same, but change the camera angle to a low angle dramatic shot'", () => {
      const initialPrompt = "A majestic stone dragon perched atop a snowy mountain peak";
      const result = composeConversationalPrompt({
        userInput: "Change the camera angle to a low angle dramatic hero perspective",
        referencePrompt: initialPrompt,
      });

      expect(result.effectivePrompt).toContain("majestic stone dragon");
      expect(result.effectivePrompt).toContain("low angle dramatic hero perspective");
      expect(result.refinementSummary).toContain("camera perspective");
    });
  });

  describe("4. Cloud Image Generation Consent Flow (Requirement 4)", () => {
    it("defaults to 'none' consent scope on startup", () => {
      expect(getCloudImageConsentScope()).toBe("none");
      expect(hasCloudImageConsent()).toBe(false);
    });

    it("grants session-scoped consent without storing in localStorage", () => {
      grantCloudImageConsent("session");
      expect(getCloudImageConsentScope()).toBe("session");
      expect(hasCloudImageConsent()).toBe(true);

      // Verify localStorage is completely clean of device consent
      expect(window.localStorage.getItem(CLOUD_IMAGE_CONSENT_DEVICE_KEY)).toBeNull();
    });

    it("grants device-scoped consent and persists in localStorage", () => {
      grantCloudImageConsent("device");
      expect(getCloudImageConsentScope()).toBe("device");
      expect(hasCloudImageConsent()).toBe(true);

      const deviceData = window.localStorage.getItem(CLOUD_IMAGE_CONSENT_DEVICE_KEY);
      expect(deviceData).not.toBeNull();
      const parsed = JSON.parse(deviceData!);
      expect(parsed.granted).toBe(true);
      expect(parsed.scope).toBe("device");
    });

    it("once consent is active, subsequent checks return true without prompting", () => {
      grantCloudImageConsent("session");
      // First check
      expect(hasCloudImageConsent()).toBe(true);
      // Repeated checks across subsequent requests in the same session
      expect(hasCloudImageConsent()).toBe(true);
      expect(hasCloudImageConsent()).toBe(true);
    });

    it("revokes consent completely and notifies subscribers", () => {
      grantCloudImageConsent("device");
      expect(hasCloudImageConsent()).toBe(true);

      let notifiedScope: string | undefined;
      const unsubscribe = subscribeCloudImageConsent((scope) => {
        notifiedScope = scope;
      });

      revokeCloudImageConsent();
      expect(getCloudImageConsentScope()).toBe("none");
      expect(hasCloudImageConsent()).toBe(false);
      expect(notifiedScope).toBe("none");

      // Verify localStorage was cleared
      expect(window.localStorage.getItem(CLOUD_IMAGE_CONSENT_DEVICE_KEY)).toBeNull();
      unsubscribe();
    });

    it("does not store any cloud credentials or API secrets in frontend storage", () => {
      grantCloudImageConsent("device");
      const storageKeys = Object.keys(window.localStorage);
      for (const key of storageKeys) {
        const val = window.localStorage.getItem(key) || "";
        expect(val.toLowerCase()).not.toContain("token");
        expect(val.toLowerCase()).not.toContain("secret");
        expect(val.toLowerCase()).not.toContain("cloudflare_api_token");
        expect(val.toLowerCase()).not.toContain("account_id");
      }
    });
  });
});
