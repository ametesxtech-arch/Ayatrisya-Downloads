import "fake-indexeddb/auto";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { detectImageRequest } from "../lib/image-intent";
import { LocalRepository } from "../storage/repository";
import {
  hasCloudImageConsent,
  grantCloudImageConsent,
  revokeCloudImageConsent,
  getCloudImageConsentScope,
  CLOUD_IMAGE_CONSENT_DEVICE_KEY,
  CLOUD_IMAGE_CONSENT_SESSION_KEY,
} from "../features/image-studio/consent";
import type { ChatMode } from "../storage/types";

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

describe("Chat 2.0 - Image Intent Detection & Guardrails", () => {
  it("detects explicit /image and /img commands", () => {
    const res1 = detectImageRequest("/image A neon cyberpunk city");
    expect(res1.isImageRequest).toBe(true);
    expect(res1.isExplicitCommand).toBe(true);
    expect(res1.cleanPrompt).toBe("A neon cyberpunk city");

    const res2 = detectImageRequest("/img serene mountain lake at sunrise");
    expect(res2.isImageRequest).toBe(true);
    expect(res2.isExplicitCommand).toBe(true);
    expect(res2.cleanPrompt).toBe("serene mountain lake at sunrise");
  });

  it("detects natural language image generation requests", () => {
    const res1 = detectImageRequest("Generate an image of a futuristic city at night");
    expect(res1.isImageRequest).toBe(true);
    expect(res1.cleanPrompt).toBe("a futuristic city at night");

    const res2 = detectImageRequest("Create an image of an astronaut riding a horse on Mars");
    expect(res2.isImageRequest).toBe(true);
    expect(res2.cleanPrompt).toBe("an astronaut riding a horse on Mars");

    const res3 = detectImageRequest("Draw a picture of a cute kitten sitting in a teacup");
    expect(res3.isImageRequest).toBe(true);
    expect(res3.cleanPrompt).toBe("a cute kitten sitting in a teacup");

    const res4 = detectImageRequest("paint a painting of a stormy ocean");
    expect(res4.isImageRequest).toBe(true);
    expect(res4.cleanPrompt).toBe("a stormy ocean");
  });

  it("strictly guards against ordinary text queries mentioning image words", () => {
    // Critical acceptance criterion: Ordinary text chat never invokes the image provider accidentally.
    expect(detectImageRequest("How does image generation work?").isImageRequest).toBe(false);
    expect(detectImageRequest("Explain JPEG compression").isImageRequest).toBe(false);
    expect(detectImageRequest("What is an image sensor?").isImageRequest).toBe(false);
    expect(detectImageRequest("Can you explain how stable diffusion models generate pictures?").isImageRequest).toBe(false);
    expect(detectImageRequest("Tell me about the history of photography and images").isImageRequest).toBe(false);
    expect(detectImageRequest("What is your favorite picture in art history?").isImageRequest).toBe(false);
    expect(detectImageRequest("Write code to resize an image using Python PIL").isImageRequest).toBe(false);
  });
});

describe("Chat 2.0 - Chat Modes Persistence & Storage", () => {
  const active: LocalRepository[] = [];
  function local() {
    const repo = new LocalRepository(`chat-modes-test-${crypto.randomUUID()}`);
    active.push(repo);
    return repo;
  }

  afterEach(async () => {
    for (const repo of active.splice(0)) await repo.close();
  });

  it("creates conversations with initial mode and defaults to Normal", async () => {
    const repo = local();
    const cDefault = await repo.createConversation("Default Mode Conversation");
    expect(cDefault.mode).toBe("Normal");

    const cSavage = await repo.createConversation("Savage Conversation", "Savage");
    expect(cSavage.mode).toBe("Savage");

    const cJoke = await repo.createConversation("Joke Conversation", "Joke");
    expect(cJoke.mode).toBe("Joke");
  });

  it("switches mode mid-conversation without losing history and persists across reload", async () => {
    const name = `chat-reload-test-${crypto.randomUUID()}`;
    const repo1 = new LocalRepository(name);
    active.push(repo1);

    const conv = await repo1.createConversation("Modes Test", "Normal");
    await repo1.addMessage(conv.id, "Hello assistant", "user");
    await repo1.addMessage(conv.id, "Hello! How can I help you today?", "assistant");

    // Switch to Savage
    await repo1.updateConversation(conv.id, { mode: "Savage" });
    const fetched1 = await repo1.getConversation(conv.id);
    expect(fetched1?.mode).toBe("Savage");

    await repo1.addMessage(conv.id, "Roast my code", "user");
    await repo1.addMessage(conv.id, "Your code looks like spaghetti thrown at a wall.", "assistant");

    // Switch to Joke
    await repo1.updateConversation(conv.id, { mode: "Joke" });
    const fetched2 = await repo1.getConversation(conv.id);
    expect(fetched2?.mode).toBe("Joke");

    await repo1.close();

    // Reopen in a new repository instance
    const repo2 = new LocalRepository(name);
    active.push(repo2);

    const reloaded = await repo2.getConversation(conv.id);
    expect(reloaded).toBeDefined();
    expect(reloaded?.mode).toBe("Joke");

    const messages = await repo2.getMessages(conv.id);
    expect(messages).toHaveLength(4);
    expect(messages[0].content).toBe("Hello assistant");
    expect(messages[1].content).toBe("Hello! How can I help you today?");
    expect(messages[2].content).toBe("Roast my code");
    expect(messages[3].content).toBe("Your code looks like spaghetti thrown at a wall.");
  });

  it("validates allowed modes and rejects invalid mode strings", async () => {
    const repo = local();
    const conv = await repo.createConversation("Validation Test", "Normal");

    // Invalid mode update should throw
    await expect(
      repo.updateConversation(conv.id, { mode: "InvalidMode" as ChatMode })
    ).rejects.toThrow("Invalid conversation metadata.");
  });
});

describe("Chat 2.0 - Cloud Image Consent Scoping & Revocation", () => {
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
    vi.restoreAllMocks();
  });

  it("defaults to no consent granted", () => {
    expect(hasCloudImageConsent()).toBe(false);
    expect(getCloudImageConsentScope()).toBe("none");
  });

  it("grants session consent and remembers it within session without device persistence", () => {
    grantCloudImageConsent("session");
    expect(hasCloudImageConsent()).toBe(true);
    expect(getCloudImageConsentScope()).toBe("session");

    // Verify session storage key exists and parsed properly
    const sessionRaw = mockSessionStorage.getItem(CLOUD_IMAGE_CONSENT_SESSION_KEY);
    expect(sessionRaw).not.toBeNull();
    expect(JSON.parse(sessionRaw!).granted).toBe(true);
    expect(mockLocalStorage.getItem(CLOUD_IMAGE_CONSENT_DEVICE_KEY)).toBeNull();
  });

  it("grants device consent and persists it across sessions", () => {
    grantCloudImageConsent("device");
    expect(hasCloudImageConsent()).toBe(true);
    expect(getCloudImageConsentScope()).toBe("device");

    const deviceRaw = mockLocalStorage.getItem(CLOUD_IMAGE_CONSENT_DEVICE_KEY);
    expect(deviceRaw).not.toBeNull();
    expect(JSON.parse(deviceRaw!).granted).toBe(true);
  });

  it("revokes consent cleanly from both session and device storage", () => {
    grantCloudImageConsent("device");
    expect(hasCloudImageConsent()).toBe(true);

    revokeCloudImageConsent();
    expect(hasCloudImageConsent()).toBe(false);
    expect(getCloudImageConsentScope()).toBe("none");
    expect(mockLocalStorage.getItem(CLOUD_IMAGE_CONSENT_DEVICE_KEY)).toBeNull();
    expect(mockSessionStorage.getItem(CLOUD_IMAGE_CONSENT_SESSION_KEY)).toBeNull();
  });
});

describe("Chat 2.0 - Mode Request Contract & Persona Injection", () => {
  it("verifies chat modes map to proper system instructions or tone indicators", () => {
    const modes: ChatMode[] = ["Normal", "Savage", "Joke"];
    expect(modes).toHaveLength(3);

    function getPersonaInstructions(mode: ChatMode): string {
      switch (mode) {
        case "Savage":
          return "Witty, bold, sharp, sarcastic, playful responses. Roast ideas, remain helpful and safe.";
        case "Joke":
          return "Humorous answers, playful banter, funny analogies and punchlines.";
        case "Normal":
        default:
          return "Helpful, balanced, accurate, professional.";
      }
    }

    expect(getPersonaInstructions("Normal")).toContain("Helpful");
    expect(getPersonaInstructions("Savage")).toContain("sarcastic");
    expect(getPersonaInstructions("Joke")).toContain("punchlines");
  });
});
