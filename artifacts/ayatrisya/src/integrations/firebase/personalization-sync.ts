import { doc, getDoc, getFirestore, onSnapshot, setDoc, type Unsubscribe } from "firebase/firestore";
import { firebaseApp } from "./client";
import type { PersonalizationPreferences, Preferences } from "@/storage/types";

export interface CloudPersonalizationSettings {
  schemaVersion: 1;
  wallpaper: string;
  personalization: PersonalizationPreferences;
  updatedAt: string;
}

const wallpaperPattern = /^(none|preset-(?:[0-9]|[1-6][0-9]))$/;

function firestore() {
  return getFirestore(firebaseApp());
}

function settingsRef(uid: string) {
  if (!uid || uid.length > 128 || uid.includes("/")) throw new Error("The signed-in account is not valid for cloud settings.");
  return doc(firestore(), "users", uid, "privateSettings", "personalization");
}

export function cloudSettingsFromPreferences(prefs: Preferences): CloudPersonalizationSettings {
  return {
    schemaVersion: 1,
    // Custom image bytes stay on this device. The cloud copy only uses built-in wallpapers.
    wallpaper: wallpaperPattern.test(prefs.wallpaper) ? prefs.wallpaper : "none",
    personalization: { ...prefs.personalization },
    updatedAt: new Date().toISOString(),
  };
}

export function cloudSettingsFingerprint(value: Pick<CloudPersonalizationSettings, "wallpaper" | "personalization">) {
  return JSON.stringify({ wallpaper: value.wallpaper, personalization: value.personalization });
}

export function parseCloudPersonalization(value: unknown): CloudPersonalizationSettings {
  if (!value || typeof value !== "object") throw new Error("Cloud settings have an unsupported format.");
  const row = value as Record<string, unknown>;
  const p = row.personalization as Record<string, unknown> | undefined;
  if (
    row.schemaVersion !== 1 ||
    typeof row.wallpaper !== "string" ||
    !wallpaperPattern.test(row.wallpaper) ||
    !p ||
    typeof p.enabled !== "boolean" ||
    typeof p.useMemory !== "boolean" ||
    typeof p.memorySummary !== "string" ||
    p.memorySummary.length > 6000 ||
    typeof p.instructions !== "string" ||
    p.instructions.length > 2000 ||
    typeof p.avoid !== "string" ||
    p.avoid.length > 1000 ||
    !["balanced", "friendly", "professional", "direct", "creative"].includes(String(p.tone)) ||
    !["concise", "balanced", "detailed"].includes(String(p.length)) ||
    !["automatic", "paragraphs", "bullets", "steps"].includes(String(p.format)) ||
    !["when-useful", "often", "rarely"].includes(String(p.examples)) ||
    !["when-needed", "assume", "ask-first"].includes(String(p.clarifying)) ||
    !["accessible", "balanced", "technical"].includes(String(p.technicality)) ||
    typeof row.updatedAt !== "string"
  ) throw new Error("Cloud settings are invalid or were created by an incompatible app version.");
  return {
    schemaVersion: 1,
    wallpaper: row.wallpaper,
    personalization: p as unknown as PersonalizationPreferences,
    updatedAt: row.updatedAt,
  };
}

export async function readCloudPersonalization(uid: string): Promise<CloudPersonalizationSettings | null> {
  const snapshot = await getDoc(settingsRef(uid));
  return snapshot.exists() ? parseCloudPersonalization(snapshot.data()) : null;
}

export async function writeCloudPersonalization(uid: string, prefs: Preferences): Promise<CloudPersonalizationSettings> {
  const value = cloudSettingsFromPreferences(prefs);
  await setDoc(settingsRef(uid), value);
  return value;
}

export function watchCloudPersonalization(
  uid: string,
  onValue: (value: CloudPersonalizationSettings | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(settingsRef(uid), (snapshot) => {
    try {
      onValue(snapshot.exists() ? parseCloudPersonalization(snapshot.data()) : null);
    } catch (error) {
      onError(error instanceof Error ? error : new Error("Cloud settings could not be read."));
    }
  }, (error) => onError(error));
}
